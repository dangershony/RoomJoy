# VPS deployment

Runbook for the live **LNVPS Tiny** host (Ubuntu 24.04, ~1 GB RAM). Build **off the VPS** — `pnpm build` / heavy installs will OOM on the box.

**Live host (HTTP, no TLS yet)**

| | |
|--|--|
| Hostname | `vm-1982.lnvps.cloud` |
| IPv4 | `185.18.221.40` |
| IPv6 | `2a13:2c0::c043:ba53:cce2:c4ed` |
| TV | http://vm-1982.lnvps.cloud/tv |
| Join | http://vm-1982.lnvps.cloud/join |
| Health | http://vm-1982.lnvps.cloud/health |

QR / join links use `http://vm-1982.lnvps.cloud` (`VITE_PUBLIC_WEB_URL`). Phones connect to `ws://vm-1982.lnvps.cloud` (`VITE_SERVER_URL`).

## Architecture

```
Internet → Nginx (:80, IPv4+IPv6)
            ├─ static SPA     /var/www/roomjoy  (apps/web/dist)
            ├─ /health /api/ /matchmake/        → 127.0.0.1:2567
            └─ WebSocket Upgrade                → 127.0.0.1:2567
Node (systemd roomjoy.service) binds loopback only.
```

In-memory rooms: **a process restart ends active sessions**. Plan restarts for quiet periods.

The VPS is too small to compile the monorepo. Build on a workstation (or the agent box), then rsync artifacts.

## Environment

| Variable | Production value | Notes |
|----------|------------------|--------|
| `PORT` | `2567` | Internal Colyseus/HTTP port |
| `HOST` | `127.0.0.1` | Bind loopback; Nginx is public |
| `NODE_ENV` | `production` | |
| `PUBLIC_WEB_URL` | `http://vm-1982.lnvps.cloud` | Server-side public origin |
| `VITE_SERVER_URL` | `ws://vm-1982.lnvps.cloud` | **Build-time** Colyseus URL |
| `VITE_PUBLIC_WEB_URL` | `http://vm-1982.lnvps.cloud` | QR / join links |

Web env vars are baked in at `pnpm build`. Rebuild the web app after changing them.

`apps/web/src/lib/serverUrl.ts` also falls back to `window.location` (same-origin `ws:` / `wss:`) if `VITE_*` is unset, so phones can still join if someone opens the site via IP.

When a real domain + TLS exist: rebuild with `wss://` / `https://` and add Certbot.

## First deploy (what we actually ran)

### 1. VPS packages (as `ubuntu`, via sudo)

```bash
ssh -i /home/box/.ssh/roomjoy_lnvps ubuntu@185.18.221.40
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg nginx rsync
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs   # Node 20 LTS
# do NOT install pnpm / do NOT run pnpm build on this host
```

Dedicated service user and dirs:

```bash
sudo useradd --system --home /opt/roomjoy --shell /usr/sbin/nologin roomjoy
sudo mkdir -p /opt/roomjoy /var/www/roomjoy
```

### 2. Production build on the workstation (not the VPS)

```bash
cd /path/to/RoomJoy
export VITE_SERVER_URL=ws://vm-1982.lnvps.cloud
export VITE_PUBLIC_WEB_URL=http://vm-1982.lnvps.cloud
pnpm install
pnpm build
# Flatten server + workspace prod deps (no VPS install)
rm -rf /tmp/roomjoy-server-prod
pnpm --filter @roomjoy/server deploy --prod /tmp/roomjoy-server-prod
```

### 3. Rsync artifacts

Do **not** `--exclude src` globally — several Node deps (e.g. `debug`) ship their runtime under `src/`.

```bash
# server (dist + production node_modules)
rsync -az --delete \
  -e "ssh -i /home/box/.ssh/roomjoy_lnvps" \
  /tmp/roomjoy-server-prod/ \
  ubuntu@185.18.221.40:~/roomjoy-staging/server/

# static web
rsync -az --delete \
  -e "ssh -i /home/box/.ssh/roomjoy_lnvps" \
  apps/web/dist/ \
  ubuntu@185.18.221.40:~/roomjoy-staging/web/

# on the VPS
sudo rsync -a --delete --exclude .env ~/roomjoy-staging/server/ /opt/roomjoy/
sudo rsync -a --delete ~/roomjoy-staging/web/ /var/www/roomjoy/
sudo chown -R roomjoy:roomjoy /opt/roomjoy
sudo chown -R www-data:www-data /var/www/roomjoy
```

`/opt/roomjoy/.env`:

```
NODE_ENV=production
HOST=127.0.0.1
PORT=2567
PUBLIC_WEB_URL=http://vm-1982.lnvps.cloud
```

### 4. systemd — `/etc/systemd/system/roomjoy.service`

```ini
[Unit]
Description=RoomJoy Colyseus
After=network.target

[Service]
Type=simple
User=roomjoy
Group=roomjoy
WorkingDirectory=/opt/roomjoy
EnvironmentFile=/opt/roomjoy/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3
MemoryMax=350M

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now roomjoy
sudo systemctl status roomjoy
```

### 5. Nginx — `/etc/nginx/sites-available/roomjoy`

Colyseus HTTP is `/health`, `/api/*`, `/matchmake/*`. After matchmake, the client opens a WebSocket to `/{processId}/{roomId}`. Nginx serves the SPA for normal GETs and proxies **Upgrade: websocket** to Node.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream roomjoy_node {
    server 127.0.0.1:2567;
    keepalive 8;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name vm-1982.lnvps.cloud 185.18.221.40 _;

    root /var/www/roomjoy;
    index index.html;

    location /health {
        proxy_pass http://roomjoy_node;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location /api/ {
        proxy_pass http://roomjoy_node;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location /matchmake/ {
        proxy_pass http://roomjoy_node;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location / {
        error_page 418 = @colyseus_ws;
        if ($http_upgrade = websocket) {
            return 418;
        }
        try_files $uri $uri/ /index.html;
    }

    location @colyseus_ws {
        proxy_pass http://roomjoy_node;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn /etc/nginx/sites-available/roomjoy /etc/nginx/sites-enabled/roomjoy
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp   # reserved for later TLS
sudo ufw --force enable
```

Port 2567 stays closed; only Nginx is public.

## Update

On the workstation:

```bash
export VITE_SERVER_URL=ws://vm-1982.lnvps.cloud
export VITE_PUBLIC_WEB_URL=http://vm-1982.lnvps.cloud
pnpm install && pnpm build
pnpm --filter @roomjoy/server deploy --prod /tmp/roomjoy-server-prod
rsync -az --delete -e "ssh -i /home/box/.ssh/roomjoy_lnvps" \
  /tmp/roomjoy-server-prod/ ubuntu@185.18.221.40:~/roomjoy-staging/server/
rsync -az --delete -e "ssh -i /home/box/.ssh/roomjoy_lnvps" \
  apps/web/dist/ ubuntu@185.18.221.40:~/roomjoy-staging/web/
```

On the VPS:

```bash
sudo systemctl stop roomjoy
sudo rsync -a --delete --exclude .env ~/roomjoy-staging/server/ /opt/roomjoy/
sudo rsync -a --delete ~/roomjoy-staging/web/ /var/www/roomjoy/
sudo chown -R roomjoy:roomjoy /opt/roomjoy
sudo chown -R www-data:www-data /var/www/roomjoy
sudo systemctl start roomjoy
```

Keep a previous web `dist` tarball if you want instant static rollback.

## Health checks

- `GET http://vm-1982.lnvps.cloud/health` → `{ ok: true, service: "roomjoy-server" }`
- `GET http://vm-1982.lnvps.cloud/api/games` → three catalog entries
- `POST http://vm-1982.lnvps.cloud/matchmake/create/roomjoy` → room + `roomCode`
- WebSocket: `Upgrade: websocket` to `/` (or `/{processId}/{roomId}`) → `101 Switching Protocols`
- Open `/tv`, create room, join from a phone via QR or `/join`

## Blockers / follow-ups

- **HTTPS / custom domain:** none yet. HTTP only on the LNVPS hostname. Add Certbot after a domain points here (`wss://` rebuild required).
- **OOM:** do not build on the VPS. Node RSS after start is ~50–60 MB; systemd `MemoryMax=350M`.
- **CORS:** Express `cors()` allows all origins; same-origin via Nginx is the production path.
- **WebSocket:** nginx upgrade map + named location is required. A probe to `/` without a Colyseus seat prints `seat reservation expired` in the journal — that is expected, not a crash.
- **IPv6:** Nginx listens on `[::]:80` and health works from the VPS. Some build agents have no IPv6 egress.

## Optional GitHub Actions CI

The `gh` OAuth token used for this repo may lack the `workflow` scope, so CI is documented here rather than committed under `.github/workflows/`. Create `.github/workflows/ci.yml` manually if desired:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: corepack enable
      - run: corepack prepare pnpm@9.15.0 --activate
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @roomjoy/protocol build
      - run: pnpm --filter @roomjoy/game-sdk build
      - run: pnpm -r --filter=./packages/games/** run build
      - run: pnpm test
      - run: pnpm build
        env:
          VITE_SERVER_URL: ws://localhost:2567
          VITE_PUBLIC_WEB_URL: http://localhost:5173
```

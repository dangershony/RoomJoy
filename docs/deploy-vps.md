# VPS deployment (Milestone 2)

Dan will provide a VPS later. This doc is the runbook for a single Linux VPS (Ubuntu 22.04+ recommended) hosting **Colyseus server + static web**.

## Architecture

```
Internet → Nginx (TLS, :443)
            ├─ /           → static files from apps/web/dist
            └─ / + WS      → Node Colyseus on 127.0.0.1:2567
```

In-memory rooms: **a process restart ends active sessions**. Plan restarts for quiet periods.

## Prerequisites

- Node 20 (`nvm` or NodeSource)
- pnpm 9.15.0 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Nginx + Certbot (or Caddy)
- Git access to `https://github.com/dangershony/RoomJoy`

## Environment

Copy `.env.example` to `.env` on the VPS and set:

| Variable | Example | Notes |
|----------|---------|--------|
| `PORT` | `2567` | Internal Colyseus/HTTP port |
| `HOST` | `127.0.0.1` | Bind loopback; Nginx proxies |
| `NODE_ENV` | `production` | |
| `PUBLIC_WEB_URL` | `https://play.example.com` | Used if server ever builds join URLs |
| `VITE_SERVER_URL` | `wss://play.example.com` | **Build-time** for web |
| `VITE_PUBLIC_WEB_URL` | `https://play.example.com` | QR / join links |

Web env vars are baked in at `pnpm --filter @roomjoy/web build`. Rebuild after changing them.

## First deploy

```bash
git clone https://github.com/dangershony/RoomJoy.git /opt/roomjoy
cd /opt/roomjoy
cp .env.example .env   # edit values
corepack enable
pnpm install --frozen-lockfile
# export VITE_* for the web build (or use a .env in apps/web)
export VITE_SERVER_URL=wss://play.example.com
export VITE_PUBLIC_WEB_URL=https://play.example.com
pnpm build
```

### Run server (systemd)

`/etc/systemd/system/roomjoy.service`:

```ini
[Unit]
Description=RoomJoy Colyseus
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/roomjoy
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=2567
ExecStart=/usr/bin/pnpm --filter @roomjoy/server start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now roomjoy
sudo systemctl status roomjoy
```

### Static web

```bash
sudo mkdir -p /var/www/roomjoy
sudo rsync -a --delete apps/web/dist/ /var/www/roomjoy/
```

### Nginx sketch

```nginx
server {
  listen 443 ssl http2;
  server_name play.example.com;
  # ssl_certificate …;

  root /var/www/roomjoy;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  # Colyseus HTTP + WebSocket (same origin keeps QR simple)
  location /api/ {
    proxy_pass http://127.0.0.1:2567;
    proxy_http_version 1.1;
  }
  location /health {
    proxy_pass http://127.0.0.1:2567;
  }
  location / {
    # Prefer splitting API under a path, OR use a separate subdomain.
  }
}
```

**Recommended:** serve web on `play.example.com` and API/WS on `api.example.com` (set `VITE_SERVER_URL=wss://api.example.com`). Enable WebSocket upgrade headers:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_read_timeout 86400;
```

## Update / rollback

```bash
cd /opt/roomjoy
git fetch origin
# Update
git checkout main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm build
sudo rsync -a --delete apps/web/dist/ /var/www/roomjoy/
sudo systemctl restart roomjoy

# Rollback to previous commit
git checkout <previous_sha>
pnpm install --frozen-lockfile
pnpm build
sudo rsync -a --delete apps/web/dist/ /var/www/roomjoy/
sudo systemctl restart roomjoy
```

Keep the last known-good `dist` tarball if you want instant static rollback:

```bash
tar -czf /opt/roomjoy-releases/web-$(git rev-parse --short HEAD).tgz -C apps/web dist
```

## Health checks

- `GET https://api…/health` → `{ ok: true }`
- `GET https://api…/api/games` → three catalog entries
- Open `/tv`, create room, join from phone

## Notes

- No Redis / sticky sessions required for single-node M2.
- Firewall: only 80/443 public; Node listens on localhost.
- Optional CI: see `.github/workflows/ci.yml` (test + build on push).


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

# RoomJoy

**Good company. Clever games.**

TV + phone multiplayer party games. Milestone 2 is the **shared platform**: game library, lobby polish, full room lifecycle, host controls, game-sdk registration, and session recovery — with placeholder tutorial/play/results for three games.

## Requirements

- Node 20
- pnpm 9.15.0 (pinned via `packageManager`)

## Quick start

```bash
corepack enable   # or: npm i -g pnpm@9.15.0
pnpm install
pnpm build        # protocol + game-sdk + games + server + web
pnpm dev          # server :2567 + web :5173
```

- Open **http://localhost:5173/tv** on the TV (or a desktop window).
- Tap **Start** (also unlocks audio).
- Open the join URL / scan QR on phones, or go to **/join** and enter the room code.
- Enter the **host claim code** shown on the TV (once).
- Host selects a game (Confidence Club / Mixed Signals / Snack Chase), toggles Family/Adult, starts **Tutorial → Round → Results**, then returns to the library.
- Room code stays visible for late join while joining is unlocked.

```bash
pnpm test         # Vitest (lifecycle, host-only, transfer, remove, lock, game switch, secrets)
pnpm build        # all packages + apps
```

## Monorepo layout

```
apps/web          React + Vite + TypeScript (TV + phone UI)
apps/server       Node + Colyseus + TypeScript (authoritative room)
packages/protocol Shared types, constants, nickname sanitize
packages/game-sdk Game registration + lifecycle hooks
packages/content  Content pack stub
packages/games/*  Confidence Club / Mixed Signals / Snack Chase (stubs)
docs/             Architecture, TV notes, VPS deploy, adding a game
```

## Environment

Copy `.env.example`. For local dev, defaults work (`ws://localhost:2567`, `http://localhost:5173`).

Production: set `PUBLIC_WEB_URL` / `VITE_PUBLIC_WEB_URL` to the public HTTPS origin used in QR codes, and `VITE_SERVER_URL` to the Colyseus WebSocket URL (`wss://…`).

## Deploy (VPS)

See **[docs/deploy-vps.md](docs/deploy-vps.md)** for env template usage, systemd, Nginx/WebSocket notes, restart/rollback. Optional CI workflow YAML is documented in docs/deploy-vps.md (add under `.github/workflows/` when the token has `workflow` scope).

## License

Private prototype — all rights reserved.

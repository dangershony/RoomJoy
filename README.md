# RoomJoy

**Good company. Clever games.**

TV + phone multiplayer party games. Milestone 1 is a working connection prototype: create a room on the TV, join from phones (QR or code), claim host, lobby, reconnect, and a small authoritative movement demo.

## Requirements

- Node 20
- pnpm 9.15.0 (pinned via `packageManager`)

## Quick start

```bash
corepack enable   # or: npm i -g pnpm@9.15.0
pnpm install
pnpm dev          # server :2567 + web :5173
```

- Open **http://localhost:5173/tv** on the TV (or a desktop window).
- Tap **Start** (also unlocks audio).
- Open the join URL / scan QR on phones, or go to **/join** and enter the room code.
- Enter the **host claim code** shown on the TV (once). Host can lock joining and start the demo.
- In **PLAYING**, phones hold D-pad directions; the TV interpolates server-authoritative positions. Stale input stops movement.

```bash
pnpm test         # Vitest (capacity, host-once, reconnect, stale input)
pnpm build        # protocol + packages + server + web
```

## Monorepo layout

```
apps/web          React + Vite + TypeScript (TV + phone UI)
apps/server       Node + Colyseus + TypeScript (authoritative room)
packages/protocol Shared types, constants, nickname sanitize
packages/game-sdk Game registration stub
packages/content  Content pack stub
packages/games/*  Confidence Club / Mixed Signals / Snack Chase stubs
docs/             Architecture, TV notes, deploy, adding a game
```

## Environment

Copy `.env.example`. For local dev, defaults work (`ws://localhost:2567`, `http://localhost:5173`).

Production: set `PUBLIC_WEB_URL` / `VITE_PUBLIC_WEB_URL` to the public HTTPS origin used in QR codes, and `VITE_SERVER_URL` to the Colyseus WebSocket URL (`wss://…`).

## Deploy notes (summary)

- **Server**: Node 20 web service (e.g. Render) running `pnpm --filter @roomjoy/server start` after build. Expose `PORT`.
- **Web**: Static host (Render Static / Cloudflare Pages / Netlify) from `apps/web/dist`.
- See [docs/architecture.md](docs/architecture.md) and deploy section in that doc.

## License

Private prototype — all rights reserved.

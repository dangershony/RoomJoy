# RoomJoy

**Good company. Clever games.**

TV + phone multiplayer party games. Playable: **Confidence Club** and **Rail Rush**. Mixed Signals & Snack Chase remain stubs. Platform: library, lobby, lifecycle, host controls.

## Requirements

- Node 20
- pnpm 9.15.0 (pinned via `packageManager`)

## Quick start

```bash
corepack enable   # or: npm i -g pnpm@9.15.0
pnpm install
pnpm build        # protocol + content + game-sdk + games + server + web
pnpm dev          # server :2567 + web :5173
```

### Play Confidence Club locally

1. Open **http://localhost:5173/tv** on the TV (or a desktop window) → **Start**.
2. Join on phones via QR / **http://localhost:5173/join** with the room code (need **2+** players).
3. Enter the **host claim code** from the TV (once).
4. Host selects **Confidence Club**, picks **Family** or **Adult** content, **Start tutorial**.
5. Advance the short tutorial (scoring is explained on-screen), then **Start round**.
6. Each question: answer + confidence 1/2/3 → clue → optional revise (confidence locked) → reveal. Six questions; scores may go negative; ties share place.

```bash
pnpm test         # content + CC + Rail Rush + server lifecycle
pnpm build
```

### Play Rail Rush locally

1. Same TV + phone lobby as above (supports **1–8** players).
2. Host selects **Rail Rush**, picks content mode, **Start tutorial**, then **Start round**.
3. Phones: large **Left** / **Right** to swap lanes. TV shows all runners staggered on one 3-lane track.
4. Hit an obstacle → eliminated. Distance = score. Round ends when everyone is out (or host ends).

## Monorepo layout

```
apps/web          React + Vite + TypeScript (TV + phone UI)
apps/server       Node + Colyseus + TypeScript (authoritative room)
packages/protocol Shared types, constants, nickname sanitize
packages/game-sdk Game registration + lifecycle hooks
packages/content  Versioned Confidence Club question packs (zod-validated)
packages/games/*  Confidence Club & Rail Rush (playable) / Mixed Signals & Snack Chase (stubs)
docs/             Architecture, TV notes, VPS deploy, adding a game
```

## Environment

Copy `.env.example`. For local dev, defaults work (`ws://localhost:2567`, `http://localhost:5173`).

Production: set `PUBLIC_WEB_URL` / `VITE_PUBLIC_WEB_URL` to the public HTTPS origin used in QR codes, and `VITE_SERVER_URL` to the Colyseus WebSocket URL (`wss://…`).

## Deploy (VPS)

See **[docs/deploy-vps.md](docs/deploy-vps.md)**. Milestone 3 does not require a VPS deploy.

## License

Private prototype — all rights reserved.

# Architecture (Milestone 1)

## Overview

RoomJoy M1 is an **authoritative Colyseus room** with a React TV display client and phone controller clients. Clients never decide positions or scores; they send intents (join, host claim, lock, start, direction input). The server owns phase, roster, and simulation.

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│  TV (web)   │◄──────────────────►│  Colyseus server │
└─────────────┘                    │  RoomJoyRoom     │
┌─────────────┐                    │  + pure logic.ts │
│ Phone (web) │◄──────────────────►│  (in-memory)     │
└─────────────┘                    └──────────────────┘
```

## Roles & permissions

| Role   | How                         | Can do                                      |
|--------|-----------------------------|---------------------------------------------|
| TV     | `create('roomjoy', {role:tv})` | Display QR, codes, lobby, playfield; reconnect with TV session token |
| Phone  | Join by room code           | Nickname + avatar; input; claim host once with host code |
| Host   | Phone who claimed host code | Lock joining, start game; still a normal player |

Capacity: **8 phones + 1 TV**. Session tokens are random (`nanoid`) and **not** derivable from the room code.

## Room phases

`LOBBY` → `PLAYING` → (`PAUSED` if TV drops) → `ENDED` (TV not back within 60s) or resume.

## Simulation

- Tick rate 20 Hz.
- Phones send `{ direction, seq }`.
- If no input for `STALE_INPUT_MS` (200ms), direction becomes `none`.
- TV renders with client-side interpolation toward authoritative `(x,y)`.

## Trust boundaries

- Sanitize nicknames (`sanitizeNickname`).
- Validate avatar IDs against presets.
- Rate-limit joins (per client key).
- Ignore client positions/scores (none accepted).
- Host actions require `player.isHost`.

## Packages

- `@roomjoy/protocol` — shared contracts.
- `@roomjoy/game-sdk` — future `registerGame` hooks (stub).
- `@roomjoy/content` — decks/prompts (stub).
- Game packages only register metadata for M1.

## Deploy (Render + static)

1. **Build**: `pnpm install && pnpm build`.
2. **API service (Render Web Service)**  
   - Root: monorepo  
   - Build: `pnpm install && pnpm build`  
   - Start: `pnpm --filter @roomjoy/server start`  
   - Env: `PORT`, `NODE_ENV=production`, `HOST=0.0.0.0`
3. **Static site**  
   - Build `apps/web` with `VITE_SERVER_URL=wss://YOUR_API` and `VITE_PUBLIC_WEB_URL=https://YOUR_WEB`.  
   - Publish `apps/web/dist`.
4. Ensure WebSocket upgrade is enabled on the API host.

Rooms are **in-memory** only — a server restart ends sessions (acceptable for M1).

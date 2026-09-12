# Architecture (Milestone 2)

## Overview

RoomJoy is an **authoritative Colyseus room** with a React TV display and phone controllers. Clients send intents; the server owns phase, roster, game module selection, and simulation stubs.

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│  TV (web)   │◄──────────────────►│  Colyseus server │
└─────────────┘                    │  RoomJoyRoom     │
┌─────────────┐   public state     │  + logic.ts     │
│ Phone (web) │◄──────────────────►│  + game-sdk mods │
└─────────────┘   + private_state  └──────────────────┘
                  (own secrets only)
```

## Roles & permissions

| Role | How | Can do |
|------|-----|--------|
| Display (TV) | `create('roomjoy', {role:tv})` | QR, codes, library reflection, phase screens; reconnect with TV token |
| Player (phone) | Join by room code | Nickname + avatar; inputs; see own private tip |
| Host (phone) | Claimed host code (once) or transfer | Select game, content mode, tutorial/round, pause/resume, lock, remove, transfer, library |

Capacity: **8 phones + 1 TV**. Session tokens are random (`nanoid`) and **not** derivable from the room code.

Host must **not** receive other players' secrets. Private payloads go only on the `private_state` channel to the owning `playerId`.

## Room phases

`LOBBY` → `TUTORIAL` → `PLAYING` → `RESULTS` → `LOBBY`

Also: `PAUSED` (host or TV disconnect) with `resumePhase` / `pauseReason`; `ENDED` if TV recover window (60s) expires.

## Game registration

`@roomjoy/game-sdk` `registerGame(GameDefinition)`. Catalog appears in public state and `GET /api/games`. Switching games cleans module state but **preserves room membership**.

## Simulation / stubs

- Tick rate 20 Hz (movement demo still used for Snack Chase / legacy start).
- Stale phone input (`STALE_INPUT_MS`) stops movement.
- Full game rules are out of scope for M2 — stubs only.

## Trust boundaries

- Sanitize nicknames; validate avatars; rate-limit joins.
- Host actions require `player.isHost`.
- Ignore client-authored positions/scores/secrets.

## Packages

- `@roomjoy/protocol` — shared contracts (M2 lifecycle + catalog)
- `@roomjoy/game-sdk` — registration + hooks
- `@roomjoy/confidence-club` / `mixed-signals` / `snack-chase` — stubs
- `@roomjoy/content` — decks/prompts (stub)

## Deploy

See [deploy-vps.md](./deploy-vps.md). Rooms are in-memory — restarts end sessions.

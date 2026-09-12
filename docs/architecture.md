# Architecture (Milestone 3)

## Overview

RoomJoy is an **authoritative Colyseus room** with a React TV display and phone controllers. Clients send intents; the server owns phase, roster, game module selection, and simulation.

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
| Player (phone) | Join by room code | Nickname + avatar; game actions; see own private answers |
| Host (phone) | Claimed host code (once) or transfer | Select game, content mode, tutorial/round, pause/resume, lock, remove, transfer, library, skip phase |

Capacity: **8 phones + 1 TV**. Session tokens are random (`nanoid`) and **not** derivable from the room code.

Host must **not** receive other players' secrets. Private payloads go only on the `private_state` channel to the owning `playerId`. TV `publicGameState` never includes unrevealed answers.

## Room phases

`LOBBY` → `TUTORIAL` → `PLAYING` → `RESULTS` → `LOBBY`

Also: `PAUSED` (host or TV disconnect) with `resumePhase` / `pauseReason`; `ENDED` if TV recover window (60s) expires.

## Confidence Club

Server-authoritative round flow: answering → locked → revising (clue) → reveal × 6. Scoring is pure TypeScript in `@roomjoy/confidence-club`. Content packs live in `@roomjoy/content` (family / adult JSON, zod-validated). Mixed Signals and Snack Chase remain stubs.

## Game registration

`@roomjoy/game-sdk` `registerGame(GameDefinition)` with optional `onAction`, `getPublicState`, `getPrivateState`, `requestEnd`. Catalog appears in public state and `GET /api/games`. Switching games cleans module state but **preserves room membership**.

## Trust boundaries

- Sanitize nicknames; validate avatars; rate-limit joins; validate game actions.
- Host actions require `player.isHost`.
- Ignore client-authored positions/scores/secrets; late actions rejected after RESULTS.

## Packages

- `@roomjoy/protocol` — shared contracts
- `@roomjoy/game-sdk` — registration + hooks
- `@roomjoy/confidence-club` — playable rules + scoring
- `@roomjoy/mixed-signals` / `snack-chase` — stubs
- `@roomjoy/content` — versioned question packs

## Deploy

See [deploy-vps.md](./deploy-vps.md). Rooms are in-memory — restarts end sessions.

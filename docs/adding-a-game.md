# Adding a game

Games register through `@roomjoy/game-sdk`. The platform owns rooms, lobby, host controls, and lifecycle; modules plug in metadata + stubs (later: real rules).

## Checklist

1. Create `packages/games/my-game` with `package.json` depending on `@roomjoy/game-sdk` and `@roomjoy/protocol`.
2. Export a `GameDefinition` and call `registerGame(...)`.
3. Fill metadata: `id`, `title`, `description`, `thumbnail`, player counts, `estimatedDurationMinutes`, `settingsSchema`.
4. Implement stubs as needed:
   - `createInitialState`, `onTutorialStart`, `onRoundStart`, `onTick`, `onInput`
   - `onEnd` → `{ summary }` for RESULTS
   - `cleanup` when returning to library / switching games
   - `getPrivateState(ctx, playerId)` — **only that player's secrets**
5. Import the package once from `apps/server/src/index.ts` (side-effect registration).
6. Keep simulation **server-side**. Phones send intents; TV renders public snapshots.
7. Add Vitest coverage for pure logic in the game package or server tests.
8. Do **not** fork the room system — switching `selectedGameId` must preserve membership.

## Lifecycle (platform)

`LOBBY` → `TUTORIAL` → `PLAYING` (game `gameSubstate` stub) → `RESULTS` → `LOBBY`

Host-only: select game, content mode, start tutorial/round, pause/resume, remove player, lock join, return to library, transfer host.

## Permissions

| Lens | Sees |
|------|------|
| Display (TV) | Public `RoomStatePublic` only |
| Player | Public + own `private_state` |
| Host | Public + host controls; **not** other players' private payloads |

Out of scope until later milestones: full Confidence Club / Mixed Signals / Snack Chase content.

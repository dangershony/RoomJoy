# Adding a game (after M1)

M1 ships registration stubs only. To add a real game:

1. Create `packages/games/my-game` with a `GameDefinition` from `@roomjoy/game-sdk`.
2. Call `registerGame({ id, name, minPlayers, maxPlayers, onStart, onTick, onInput, onEnd })`.
3. Keep simulation **server-side**. Phones send intents; TV renders snapshots.
4. Add content to `@roomjoy/content` if the game needs decks/prompts.
5. Wire a host “pick game” step in the lobby (not in M1).
6. Add Vitest coverage for scoring / edge rules in pure logic modules.

Out of scope for M1: Confidence Club, Mixed Signals, Snack Chase beyond stubs.

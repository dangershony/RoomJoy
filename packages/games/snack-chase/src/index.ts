import { registerGame, type GameContext, type GameDefinition } from '@roomjoy/game-sdk';
import type { ContentMode } from '@roomjoy/protocol';

interface ScState {
  snacksLeft: number;
  secrets: Record<string, string>;
}

function ensureSecrets(ctx: GameContext): ScState {
  let state = ctx.gameState as ScState | null;
  if (!state) {
    state = { snacksLeft: 5, secrets: {} };
    ctx.setGameState(state);
  }
  for (const p of ctx.players) {
    if (!state.secrets[p.id]) {
      state.secrets[p.id] = `sc-snack:${p.id.slice(0, 6)}`;
    }
  }
  ctx.setGameState(state);
  return state;
}

export const snackChase: GameDefinition = {
  id: 'snack-chase',
  title: 'Snack Chase',
  description:
    'Race for the last snack before someone else grabs it. Placeholder — full rules in a later milestone.',
  thumbnail: '🍪',
  minPlayers: 2,
  maxPlayers: 8,
  estimatedDurationMinutes: 10,
  settingsSchema: [
    {
      key: 'contentMode',
      label: 'Content',
      type: 'enum',
      options: ['family', 'adult'],
      defaultValue: 'family',
    },
  ],
  createInitialState(_contentMode: ContentMode) {
    return { snacksLeft: 5, secrets: {} };
  },
  onTutorialStart(ctx) {
    ensureSecrets(ctx);
    ctx.setSubstate('tutorial');
  },
  onRoundStart(ctx) {
    const s = ensureSecrets(ctx);
    s.snacksLeft = 5;
    ctx.setGameState(s);
    ctx.setSubstate('chasing');
  },
  onInput(ctx, playerId, direction) {
    // M1-style movement still handled by platform; game stub notes intent
    void ctx;
    void playerId;
    void direction;
  },
  onEnd(ctx) {
    ctx.setSubstate(null);
    return { summary: 'Snack Chase — placeholder results. Snacks secured!' };
  },
  cleanup(ctx) {
    ctx.setGameState(null);
    ctx.setSubstate(null);
  },
  getPrivateState(ctx, playerId) {
    const s = ensureSecrets(ctx);
    return { gameId: 'snack-chase', secret: s.secrets[playerId] ?? null };
  },
  getSubstate(ctx) {
    const s = ctx.gameState as ScState | null;
    return s ? `snacks_${s.snacksLeft}` : null;
  },
};

registerGame(snackChase);
export default snackChase;

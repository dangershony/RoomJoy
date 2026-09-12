import { registerGame, type GameContext, type GameDefinition } from '@roomjoy/game-sdk';
import type { ContentMode } from '@roomjoy/protocol';

interface CcState {
  round: number;
  secrets: Record<string, string>;
}

function ensureSecrets(ctx: GameContext): CcState {
  let state = ctx.gameState as CcState | null;
  if (!state) {
    state = { round: 1, secrets: {} };
    ctx.setGameState(state);
  }
  for (const p of ctx.players) {
    if (!state.secrets[p.id]) {
      state.secrets[p.id] = `cc-secret:${p.id.slice(0, 6)}`;
    }
  }
  ctx.setGameState(state);
  return state;
}

export const confidenceClub: GameDefinition = {
  id: 'confidence-club',
  title: 'Confidence Club',
  description:
    'Build each other up with compliments and bold claims. Placeholder — full rules in a later milestone.',
  thumbnail: '💪',
  minPlayers: 3,
  maxPlayers: 8,
  estimatedDurationMinutes: 15,
  settingsSchema: [
    {
      key: 'contentMode',
      label: 'Content',
      type: 'enum',
      options: ['family', 'adult'],
      defaultValue: 'family',
    },
  ],
  createInitialState(contentMode: ContentMode) {
    return { round: 1, secrets: {}, contentMode };
  },
  onTutorialStart(ctx) {
    ensureSecrets(ctx);
    ctx.setSubstate('tutorial');
  },
  onRoundStart(ctx) {
    const s = ensureSecrets(ctx);
    s.round = 1;
    ctx.setGameState(s);
    ctx.setSubstate('round_1');
  },
  onTick(ctx) {
    // stub — no simulation yet
    void ctx;
  },
  onEnd(ctx) {
    ctx.setSubstate(null);
    return { summary: 'Confidence Club — placeholder results. Everyone did great!' };
  },
  cleanup(ctx) {
    ctx.setGameState(null);
    ctx.setSubstate(null);
  },
  getPrivateState(ctx, playerId) {
    const s = ensureSecrets(ctx);
    return { gameId: 'confidence-club', secret: s.secrets[playerId] ?? null };
  },
  getSubstate(ctx) {
    const s = ctx.gameState as CcState | null;
    return s ? `round_${s.round}` : null;
  },
};

registerGame(confidenceClub);
export default confidenceClub;

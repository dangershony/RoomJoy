import { registerGame, type GameContext, type GameDefinition } from '@roomjoy/game-sdk';
import type { ContentMode } from '@roomjoy/protocol';

interface MsState {
  phaseLabel: string;
  secrets: Record<string, string>;
}

function ensureSecrets(ctx: GameContext): MsState {
  let state = ctx.gameState as MsState | null;
  if (!state) {
    state = { phaseLabel: 'idle', secrets: {} };
    ctx.setGameState(state);
  }
  for (const p of ctx.players) {
    if (!state.secrets[p.id]) {
      state.secrets[p.id] = `ms-signal:${p.id.slice(0, 6)}`;
    }
  }
  ctx.setGameState(state);
  return state;
}

export const mixedSignals: GameDefinition = {
  id: 'mixed-signals',
  title: 'Mixed Signals',
  description:
    'Decode social cues and call the bluff. Placeholder — full rules in a later milestone.',
  thumbnail: '📡',
  minPlayers: 2,
  maxPlayers: 8,
  estimatedDurationMinutes: 12,
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
    return { phaseLabel: 'idle', secrets: {} };
  },
  onTutorialStart(ctx) {
    const s = ensureSecrets(ctx);
    s.phaseLabel = 'tutorial';
    ctx.setGameState(s);
    ctx.setSubstate('tutorial');
  },
  onRoundStart(ctx) {
    const s = ensureSecrets(ctx);
    s.phaseLabel = 'signals';
    ctx.setGameState(s);
    ctx.setSubstate('signals');
  },
  onEnd(ctx) {
    ctx.setSubstate(null);
    return { summary: 'Mixed Signals — placeholder results. Signals decoded!' };
  },
  cleanup(ctx) {
    ctx.setGameState(null);
    ctx.setSubstate(null);
  },
  getPrivateState(ctx, playerId) {
    const s = ensureSecrets(ctx);
    return { gameId: 'mixed-signals', secret: s.secrets[playerId] ?? null };
  },
  getSubstate(ctx) {
    const s = ctx.gameState as MsState | null;
    return s?.phaseLabel ?? null;
  },
};

registerGame(mixedSignals);
export default mixedSignals;

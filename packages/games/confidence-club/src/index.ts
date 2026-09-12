import { registerGame, type GameContext, type GameDefinition } from '@roomjoy/game-sdk';
import type { ContentMode } from '@roomjoy/protocol';
import {
  advancePhase,
  beginRound,
  beginTutorial,
  buildPrivateState,
  buildPublicState,
  createCcState,
  maybeEarlyLock,
  reviseAnswer,
  submitAnswer,
  substateLabel,
  tickEngine,
  tutorialAdvance,
  type EnginePlayer,
} from './engine.js';
import type { CcState } from './types.js';
import { TUTORIAL_STEPS } from './types.js';

export { scoreRound, computePlacements } from './scoring.js';
export type { CcPublicState, CcPrivateState, CcState } from './types.js';
export { QUESTIONS_PER_GAME, TUTORIAL_STEPS, PHASE_MS } from './types.js';

function asState(ctx: GameContext): CcState {
  let state = ctx.gameState as CcState | null;
  if (!state) {
    state = createCcState(ctx.contentMode);
    ctx.setGameState(state);
  }
  return state;
}

function playersOf(ctx: GameContext): EnginePlayer[] {
  return ctx.players.map((p) => ({ id: p.id, nickname: p.nickname }));
}

function syncSubstate(ctx: GameContext, state: CcState): void {
  const inTutorial = ctx.phase === 'TUTORIAL';
  ctx.setSubstate(substateLabel(state, inTutorial));
}

export const confidenceClub: GameDefinition = {
  id: 'confidence-club',
  title: 'Confidence Club',
  description:
    'Answer clever questions, stake your confidence (1–3), then reconsider with a clue. Six rounds — about 8–12 minutes.',
  thumbnail: '🎯',
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
  createInitialState(contentMode: ContentMode) {
    return createCcState(contentMode);
  },
  onTutorialStart(ctx) {
    const state = createCcState(ctx.contentMode);
    beginTutorial(state, playersOf(ctx));
    ctx.setGameState(state);
    syncSubstate(ctx, state);
  },
  onRoundStart(ctx) {
    let state = ctx.gameState as CcState | null;
    if (!state || state.contentMode !== ctx.contentMode) {
      state = createCcState(ctx.contentMode);
    }
    // Fresh scores for a new game
    state.scores = {};
    beginRound(state, playersOf(ctx), ctx.now);
    ctx.setGameState(state);
    syncSubstate(ctx, state);
  },
  onTick(ctx) {
    if (ctx.phase !== 'PLAYING') return;
    const state = asState(ctx);
    if (state.finished) return;
    maybeEarlyLock(state, playersOf(ctx), ctx.now);
    const { ended, phaseChanged } = tickEngine(state, playersOf(ctx), ctx.now);
    ctx.setGameState(state);
    if (phaseChanged) syncSubstate(ctx, state);
    if (ended && state.resultsSummary) {
      ctx.requestEnd(state.resultsSummary);
    }
  },
  onAction(ctx, playerId, action, payload) {
    const state = asState(ctx);
    const players = playersOf(ctx);

    if (action === 'tutorial_next') {
      if (ctx.phase !== 'TUTORIAL') {
        return { ok: false, error: 'Not in tutorial' };
      }
      const host = ctx.players.find((p) => p.id === playerId);
      // Any player can advance their own reading; host advances shared step
      if (!host?.isHost && action === 'tutorial_next') {
        // Allow any player to advance the shared tutorial (party UX)
      }
      tutorialAdvance(state);
      ctx.setGameState(state);
      syncSubstate(ctx, state);
      return { ok: true };
    }

    if (action === 'advance') {
      const host = ctx.players.find((p) => p.id === playerId);
      if (!host?.isHost) return { ok: false, error: 'Host only' };
      if (ctx.phase === 'TUTORIAL') {
        tutorialAdvance(state);
        ctx.setGameState(state);
        syncSubstate(ctx, state);
        return { ok: true };
      }
      if (ctx.phase !== 'PLAYING' || state.finished) {
        return { ok: false, error: 'Cannot advance' };
      }
      const { ended } = advancePhase(state, players, ctx.now);
      ctx.setGameState(state);
      syncSubstate(ctx, state);
      if (ended && state.resultsSummary) {
        ctx.requestEnd(state.resultsSummary);
      }
      return { ok: true };
    }

    if (action === 'submit_answer') {
      if (ctx.phase !== 'PLAYING') return { ok: false, error: 'Not playing' };
      const body = payload as { optionIndex?: unknown; confidence?: unknown };
      const result = submitAnswer(
        state,
        playerId,
        Number(body?.optionIndex),
        Number(body?.confidence),
      );
      if (result.ok) {
        maybeEarlyLock(state, players, ctx.now);
        ctx.setGameState(state);
      }
      return result;
    }

    if (action === 'revise_answer') {
      if (ctx.phase !== 'PLAYING') return { ok: false, error: 'Not playing' };
      const body = payload as { optionIndex?: unknown };
      const result = reviseAnswer(
        state,
        playerId,
        Number(body?.optionIndex),
      );
      if (result.ok) ctx.setGameState(state);
      return result;
    }

    return { ok: false, error: `Unknown action: ${action}` };
  },
  onEnd(ctx) {
    const state = asState(ctx);
    if (!state.resultsSummary) {
      const pubs = buildPublicState(state, playersOf(ctx), false);
      const lines = pubs.scores.map((s, i) => `#${i + 1} ${s.nickname}: ${s.score}`);
      state.resultsSummary = `Confidence Club — ${lines.join(' · ') || 'Done'}`;
      ctx.setGameState(state);
    }
    ctx.setSubstate(null);
    return { summary: state.resultsSummary };
  },
  cleanup(ctx) {
    ctx.setGameState(null);
    ctx.setSubstate(null);
  },
  getPrivateState(ctx, playerId) {
    const state = asState(ctx);
    return buildPrivateState(state, playerId, ctx.phase === 'TUTORIAL');
  },
  getPublicState(ctx) {
    const state = asState(ctx);
    return buildPublicState(state, playersOf(ctx), ctx.phase === 'TUTORIAL');
  },
  getSubstate(ctx) {
    const state = ctx.gameState as CcState | null;
    if (!state) return null;
    return substateLabel(state, ctx.phase === 'TUTORIAL');
  },
};

registerGame(confidenceClub);
export default confidenceClub;

// Re-export tutorial copy for UI
export const TUTORIAL_COPY: Record<string, { title: string; body: string }> = {
  welcome: {
    title: 'Welcome to Confidence Club',
    body: 'Six questions. Pick an answer, then stake how sure you are (1, 2, or 3).',
  },
  scoring: {
    title: 'How scoring works',
    body: 'Correct & stick: confidence × 100. Correct after a change: × 50. Wrong: −confidence × 50. Miss the first submit: zero (no revision). Scores can go negative; ties share place.',
  },
  answer: {
    title: 'Step 1 — Answer',
    body: 'Choose one of four options on your phone. Everyone answers the same question shown on the TV.',
  },
  confidence: {
    title: 'Step 2 — Confidence',
    body: 'Tap 1, 2, or 3. Higher confidence means bigger swings — up or down.',
  },
  clue: {
    title: 'Step 3 — Clue & rethink',
    body: 'After answers lock, a clue appears. You may change your answer, but not your confidence. Then we reveal!',
  },
  ready: {
    title: 'Ready?',
    body: 'Host starts the round when everyone is set. Good company. Clever games.',
  },
};

void TUTORIAL_STEPS;

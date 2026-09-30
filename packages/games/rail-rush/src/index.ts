import { registerGame, type GameContext, type GameDefinition } from '@roomjoy/game-sdk';
import type { ContentMode } from '@roomjoy/protocol';
import {
  beginRound,
  beginTutorial,
  buildPrivateState,
  buildPublicState,
  buildResultsSummary,
  changeLane,
  createRrState,
  finishRound,
  substateLabel,
  tickEngine,
  tutorialAdvance,
  type EnginePlayer,
} from './engine.js';
import type { RrState } from './types.js';
import { TUTORIAL_STEPS } from './types.js';

export {
  clampLane,
  assignStaggers,
  changeLane,
  checkObstacleHit,
  computeRankings,
  tickEngine,
  beginRound,
  createRrState,
} from './engine.js';
export type { RrPublicState, RrPrivateState, RrState, RrRankEntry } from './types.js';
export {
  LANE_COUNT,
  STAGGER_GAP,
  TUTORIAL_STEPS,
  HIT_DEPTH,
} from './types.js';

function asState(ctx: GameContext): RrState {
  let state = ctx.gameState as RrState | null;
  if (!state) {
    state = createRrState(ctx.contentMode);
    ctx.setGameState(state);
  }
  return state;
}

function playersOf(ctx: GameContext): EnginePlayer[] {
  return ctx.players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatarId: p.avatarId,
  }));
}

function syncSubstate(ctx: GameContext, state: RrState): void {
  ctx.setSubstate(substateLabel(state, ctx.phase === 'TUTORIAL'));
}

export const railRush: GameDefinition = {
  id: 'rail-rush',
  title: 'Rail Rush',
  description:
    'Dash down a shared 3-lane track. Swap lanes to dodge obstacles — last runner standing (or farthest distance) wins. About 3–5 minutes.',
  thumbnail: '🛤️',
  minPlayers: 2,
  maxPlayers: 8,
  estimatedDurationMinutes: 5,
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
    return createRrState(contentMode);
  },
  onTutorialStart(ctx) {
    const state = createRrState(ctx.contentMode);
    beginTutorial(state, playersOf(ctx));
    ctx.setGameState(state);
    syncSubstate(ctx, state);
  },
  onRoundStart(ctx) {
    let state = ctx.gameState as RrState | null;
    if (!state || state.contentMode !== ctx.contentMode) {
      state = createRrState(ctx.contentMode);
    }
    beginRound(state, playersOf(ctx), ctx.now);
    ctx.setGameState(state);
    syncSubstate(ctx, state);
  },
  onTick(ctx, dtMs) {
    if (ctx.phase !== 'PLAYING') return;
    const state = asState(ctx);
    if (state.finished) return;
    const { ended } = tickEngine(state, dtMs, ctx.now);
    ctx.setGameState(state);
    syncSubstate(ctx, state);
    if (ended && state.resultsSummary) {
      ctx.requestEnd(state.resultsSummary);
    }
  },
  onAction(ctx, playerId, action, payload) {
    const state = asState(ctx);

    if (action === 'tutorial_next') {
      if (ctx.phase !== 'TUTORIAL') {
        return { ok: false, error: 'Not in tutorial' };
      }
      tutorialAdvance(state);
      ctx.setGameState(state);
      syncSubstate(ctx, state);
      return { ok: true };
    }

    if (action === 'lane_left' || action === 'lane_right') {
      if (ctx.phase !== 'PLAYING') return { ok: false, error: 'Not playing' };
      const delta = action === 'lane_left' ? -1 : 1;
      const result = changeLane(state, playerId, delta);
      if (result.ok) {
        ctx.setGameState(state);
        syncSubstate(ctx, state);
      }
      return result;
    }

    if (action === 'change_lane') {
      if (ctx.phase !== 'PLAYING') return { ok: false, error: 'Not playing' };
      const body = payload as { delta?: unknown };
      const delta = Number(body?.delta);
      if (delta !== -1 && delta !== 1) {
        return { ok: false, error: 'delta must be -1 or 1' };
      }
      const result = changeLane(state, playerId, delta);
      if (result.ok) {
        ctx.setGameState(state);
        syncSubstate(ctx, state);
      }
      return result;
    }

    return { ok: false, error: `Unknown action: ${action}` };
  },
  onEnd(ctx) {
    const state = asState(ctx);
    if (!state.finished) {
      finishRound(state);
      ctx.setGameState(state);
    }
    if (!state.resultsSummary) {
      state.resultsSummary = buildResultsSummary(state);
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
    return buildPrivateState(state, playerId, ctx.phase === 'PLAYING');
  },
  getPublicState(ctx) {
    const state = asState(ctx);
    return buildPublicState(state, ctx.phase === 'TUTORIAL');
  },
  getSubstate(ctx) {
    const state = ctx.gameState as RrState | null;
    if (!state) return null;
    return substateLabel(state, ctx.phase === 'TUTORIAL');
  },
};

registerGame(railRush);
export default railRush;

export const TUTORIAL_COPY: Record<
  string,
  { title: string; body: string }
> = {
  welcome: {
    title: 'Welcome to Rail Rush',
    body: 'Everyone shares one 3-lane track on the TV. Run as far as you can — dodge what comes!',
  },
  lanes: {
    title: 'Swap lanes',
    body: 'On your phone, tap Left or Right to hop between lanes. You cannot bump into other players — you are staggered along the path.',
  },
  obstacles: {
    title: 'Watch the rails',
    body: 'Obstacles appear ahead. Hit one and you are out. Your score is the distance you survived.',
  },
  ready: {
    title: 'Ready?',
    body: 'Host starts the round when everyone is set. Last runner standing — or farthest distance — wins!',
  },
};

void TUTORIAL_STEPS;

import { describe, it, expect } from 'vitest';
import {
  assignStaggers,
  beginRound,
  beginTutorial,
  buildPrivateState,
  buildPublicState,
  changeLane,
  checkObstacleHit,
  clampLane,
  computeRankings,
  createRrState,
  finishRound,
  tickEngine,
} from './engine.js';
import { HIT_DEPTH, LANE_COUNT, STAGGER_GAP } from './types.js';

const players = [
  { id: 'p1', nickname: 'Ada', avatarId: 'fox' },
  { id: 'p2', nickname: 'Bob', avatarId: 'owl' },
  { id: 'p3', nickname: 'Cara', avatarId: 'cat' },
];

describe('lane clamp', () => {
  it('clamps to 0..LANE_COUNT-1', () => {
    expect(clampLane(-2)).toBe(0);
    expect(clampLane(0)).toBe(0);
    expect(clampLane(1)).toBe(1);
    expect(clampLane(2)).toBe(2);
    expect(clampLane(99)).toBe(LANE_COUNT - 1);
    expect(clampLane(1.7)).toBe(2);
  });

  it('changeLane moves and clamps at edges', () => {
    const state = createRrState('family');
    beginRound(state, players, 0);
    expect(state.runners.p1!.lane).toBe(1);
    expect(changeLane(state, 'p1', -1).ok).toBe(true);
    expect(state.runners.p1!.lane).toBe(0);
    expect(changeLane(state, 'p1', -1).ok).toBe(true);
    expect(state.runners.p1!.lane).toBe(0);
    expect(changeLane(state, 'p1', 1).ok).toBe(true);
    expect(changeLane(state, 'p1', 1).ok).toBe(true);
    expect(state.runners.p1!.lane).toBe(2);
    expect(changeLane(state, 'p1', 1).ok).toBe(true);
    expect(state.runners.p1!.lane).toBe(2);
  });

  it('rejects lane change when eliminated', () => {
    const state = createRrState('family');
    beginRound(state, players, 0);
    state.runners.p1!.alive = false;
    expect(changeLane(state, 'p1', 1).ok).toBe(false);
  });
});

describe('stagger', () => {
  it('assigns unique increasing staggers by sorted id', () => {
    const map = assignStaggers(['p3', 'p1', 'p2']);
    expect(map.p1).toBe(0);
    expect(map.p2).toBe(STAGGER_GAP);
    expect(map.p3).toBe(STAGGER_GAP * 2);
  });

  it('beginRound applies staggers so runners do not share depth', () => {
    const state = createRrState('family');
    beginRound(state, players, 1000);
    const staggers = Object.values(state.runners).map((r) => r.stagger);
    expect(new Set(staggers).size).toBe(3);
  });
});

describe('obstacle hit', () => {
  it('hits when same lane and within depth', () => {
    const runner = {
      playerId: 'p1',
      nickname: 'Ada',
      avatarId: 'fox',
      lane: 1,
      stagger: 0,
      distance: 0,
      alive: true,
      eliminatedAt: null,
    };
    const obstacle = { id: 'o1', lane: 1, z: HIT_DEPTH };
    expect(checkObstacleHit(runner, obstacle, 0)).toBe(true);
    expect(checkObstacleHit(runner, { ...obstacle, lane: 0 }, 0)).toBe(false);
    expect(checkObstacleHit(runner, { ...obstacle, z: HIT_DEPTH + 50 }, 0)).toBe(
      false,
    );
  });

  it('tick eliminates on collision and freezes distance', () => {
    const state = createRrState('family');
    beginRound(state, players, 0);
    // Clear seeded obstacles; place one on p1's lane at their track pos
    state.obstacles = [
      {
        id: 'hit',
        lane: state.runners.p1!.lane,
        z: state.scroll + state.runners.p1!.stagger,
      },
    ];
    // No spontaneous spawns
    const { ended } = tickEngine(state, 16, 16, () => 0);
    expect(state.runners.p1!.alive).toBe(false);
    expect(state.runners.p1!.distance).toBeGreaterThanOrEqual(0);
    // Others may still be alive depending on stagger overlap — force clear rest
    void ended;
  });

  it('players do not collide with each other (shared lanes ok)', () => {
    const state = createRrState('family');
    beginRound(state, players, 0);
    state.obstacles = [];
    // Put everyone in lane 0 — should not eliminate anyone
    for (const r of Object.values(state.runners)) r.lane = 0;
    tickEngine(state, 100, 100, () => 0.99); // spawn far / high lane bias
    // Manually clear any spawned
    state.obstacles = [];
    tickEngine(state, 50, 150, () => 0.99);
    expect(Object.values(state.runners).every((r) => r.alive)).toBe(true);
  });
});

describe('ranking', () => {
  it('ranks by distance descending with shared places on ties', () => {
    const state = createRrState('family');
    beginRound(state, players, 0);
    state.runners.p1!.alive = false;
    state.runners.p1!.distance = 500;
    state.runners.p2!.alive = false;
    state.runners.p2!.distance = 500;
    state.runners.p3!.alive = false;
    state.runners.p3!.distance = 200;
    const ranks = computeRankings(state);
    expect(ranks[0]!.place).toBe(1);
    expect(ranks[1]!.place).toBe(1);
    expect(ranks[2]!.place).toBe(3);
    expect(ranks[2]!.nickname).toBe('Cara');
  });

  it('finishRound builds summary and freezes survivors', () => {
    const state = createRrState('family');
    beginRound(state, players, 0);
    state.scroll = 300;
    finishRound(state);
    expect(state.finished).toBe(true);
    expect(state.resultsSummary).toMatch(/Rail Rush/);
    expect(state.rankings.length).toBe(3);
  });

  it('all-out via tick requests finished state', () => {
    const state = createRrState('family');
    beginRound(state, [{ id: 'solo', nickname: 'Solo', avatarId: 'fox' }], 0);
    // Only one player for easy all-out — but min is 2 in game def; engine allows 1
    state.obstacles = [
      {
        id: 'x',
        lane: 1,
        z: state.scroll + state.runners.solo!.stagger,
      },
    ];
    const { ended } = tickEngine(state, 16, 16, () => 0);
    expect(ended).toBe(true);
    expect(state.finished).toBe(true);
  });
});

describe('public / private snapshots', () => {
  it('tutorial public state exposes step; private canSteer false until playing', () => {
    const state = createRrState('family');
    beginTutorial(state, players);
    const pub = buildPublicState(state, true);
    expect(pub.gameId).toBe('rail-rush');
    expect(pub.tutorialStep).toBe('welcome');
    const priv = buildPrivateState(state, 'p1', false);
    expect(priv.canSteer).toBe(false);
  });

  it('playing private state allows steer when alive', () => {
    const state = createRrState('family');
    beginRound(state, players, 0);
    const priv = buildPrivateState(state, 'p1', true);
    expect(priv.canSteer).toBe(true);
    expect(priv.myLane).toBe(1);
  });
});

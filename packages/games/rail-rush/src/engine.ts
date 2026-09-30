/**
 * Rail Rush pure engine — server-authoritative endless runner rules.
 * No React/Colyseus.
 */
import type { ContentMode } from '@roomjoy/protocol';
import {
  BASE_SPEED,
  HIT_DEPTH,
  LANE_COUNT,
  MAX_SPEED,
  SPAWN_AHEAD,
  SPAWN_INTERVAL_MS,
  SPEED_RAMP,
  STAGGER_GAP,
  TUTORIAL_STEPS,
  VISIBLE_TRACK,
  type RrObstacle,
  type RrPrivateState,
  type RrPublicState,
  type RrRankEntry,
  type RrRunner,
  type RrState,
  type RrTutorialStep,
} from './types.js';

export interface EnginePlayer {
  id: string;
  nickname: string;
  avatarId: string;
}

export function clampLane(lane: number): number {
  if (!Number.isFinite(lane)) return 1;
  return Math.max(0, Math.min(LANE_COUNT - 1, Math.round(lane)));
}

/** Assign stagger so runners share rails without overlapping (sorted by id for stability). */
export function assignStaggers(playerIds: string[]): Record<string, number> {
  const sorted = [...playerIds].sort();
  const out: Record<string, number> = {};
  sorted.forEach((id, i) => {
    // Spread around origin: first slightly ahead, later further ahead
    out[id] = i * STAGGER_GAP;
  });
  return out;
}

export function createRrState(
  contentMode: ContentMode,
  _seed = Date.now(),
): RrState {
  return {
    contentMode,
    tutorialStepIndex: 0,
    scroll: 0,
    speed: BASE_SPEED,
    startedAt: 0,
    lastSpawnAt: 0,
    nextObstacleId: 1,
    runners: {},
    obstacles: [],
    finished: false,
    resultsSummary: null,
    rankings: [],
  };
}

function ensureRunners(state: RrState, players: EnginePlayer[]): void {
  const staggers = assignStaggers(players.map((p) => p.id));
  const keep = new Set(players.map((p) => p.id));
  for (const id of Object.keys(state.runners)) {
    if (!keep.has(id)) delete state.runners[id];
  }
  for (const p of players) {
    const existing = state.runners[p.id];
    if (existing) {
      existing.nickname = p.nickname;
      existing.avatarId = p.avatarId;
      existing.stagger = staggers[p.id] ?? existing.stagger;
      continue;
    }
    state.runners[p.id] = {
      playerId: p.id,
      nickname: p.nickname,
      avatarId: p.avatarId,
      lane: 1,
      stagger: staggers[p.id] ?? 0,
      distance: 0,
      alive: true,
      eliminatedAt: null,
    };
  }
}

export function beginTutorial(state: RrState, players: EnginePlayer[]): void {
  ensureRunners(state, players);
  state.tutorialStepIndex = 0;
  state.finished = false;
  state.resultsSummary = null;
  state.rankings = [];
  state.scroll = 0;
  state.speed = BASE_SPEED;
  state.obstacles = [];
}

export function tutorialAdvance(state: RrState): void {
  if (state.tutorialStepIndex < TUTORIAL_STEPS.length - 1) {
    state.tutorialStepIndex += 1;
  }
}

export function beginRound(
  state: RrState,
  players: EnginePlayer[],
  now: number,
): void {
  ensureRunners(state, players);
  for (const r of Object.values(state.runners)) {
    r.lane = 1;
    r.distance = 0;
    r.alive = true;
    r.eliminatedAt = null;
  }
  state.scroll = 0;
  state.speed = BASE_SPEED;
  state.startedAt = now;
  state.lastSpawnAt = now;
  state.nextObstacleId = 1;
  state.obstacles = [];
  state.finished = false;
  state.resultsSummary = null;
  state.rankings = [];
  // Seed a couple of obstacles ahead so the track isn't empty
  spawnObstacle(state, 1, state.scroll + SPAWN_AHEAD * 0.55);
  spawnObstacle(state, 0, state.scroll + SPAWN_AHEAD * 0.85);
}

function spawnObstacle(state: RrState, lane: number, z: number): void {
  const id = `obs-${state.nextObstacleId++}`;
  state.obstacles.push({ id, lane: clampLane(lane), z });
}

function leadTrackPos(state: RrState): number {
  let lead = state.scroll;
  for (const r of Object.values(state.runners)) {
    if (!r.alive) continue;
    lead = Math.max(lead, state.scroll + r.stagger);
  }
  return lead;
}

function pruneObstacles(state: RrState): void {
  const minZ = state.scroll - 80;
  state.obstacles = state.obstacles.filter((o) => o.z >= minZ);
}

function maybeSpawn(state: RrState, now: number, rng: () => number): void {
  if (now - state.lastSpawnAt < SPAWN_INTERVAL_MS) return;
  state.lastSpawnAt = now;
  const lane = Math.floor(rng() * LANE_COUNT);
  const z = leadTrackPos(state) + SPAWN_AHEAD + rng() * 40;
  spawnObstacle(state, lane, z);
}

export function changeLane(
  state: RrState,
  playerId: string,
  delta: number,
): { ok: boolean; error?: string } {
  if (state.finished) return { ok: false, error: 'Round finished' };
  const runner = state.runners[playerId];
  if (!runner) return { ok: false, error: 'Unknown player' };
  if (!runner.alive) return { ok: false, error: 'Eliminated' };
  const next = clampLane(runner.lane + delta);
  if (next === runner.lane && (runner.lane === 0 || runner.lane === LANE_COUNT - 1)) {
    // Already at edge — still ok (no-op clamp)
    runner.lane = next;
    return { ok: true };
  }
  runner.lane = next;
  return { ok: true };
}

function runnerTrackPos(state: RrState, runner: RrRunner): number {
  return state.scroll + runner.stagger;
}

export function checkObstacleHit(
  runner: RrRunner,
  obstacle: RrObstacle,
  scroll: number,
): boolean {
  if (!runner.alive) return false;
  if (obstacle.lane !== runner.lane) return false;
  const pos = scroll + runner.stagger;
  return Math.abs(obstacle.z - pos) <= HIT_DEPTH;
}

function eliminate(runner: RrRunner, now: number, scroll: number): void {
  if (!runner.alive) return;
  runner.alive = false;
  runner.eliminatedAt = now;
  runner.distance = Math.floor(scroll + runner.stagger);
}

export function computeRankings(state: RrState): RrRankEntry[] {
  const list = Object.values(state.runners).map((r) => ({
    playerId: r.playerId,
    nickname: r.nickname,
    avatarId: r.avatarId,
    distance: r.alive
      ? Math.floor(state.scroll + r.stagger)
      : r.distance,
    alive: r.alive,
  }));
  // Higher distance first; alive with same distance ranks above eliminated
  list.sort((a, b) => {
    if (b.distance !== a.distance) return b.distance - a.distance;
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return a.nickname.localeCompare(b.nickname);
  });
  // Dense ranking with ties sharing place
  const ranked: RrRankEntry[] = [];
  let place = 1;
  for (let i = 0; i < list.length; i++) {
    const cur = list[i]!;
    if (i > 0) {
      const prev = list[i - 1]!;
      if (cur.distance !== prev.distance || cur.alive !== prev.alive) {
        place = i + 1;
      }
    }
    ranked.push({ ...cur, place });
  }
  return ranked;
}

export function buildResultsSummary(state: RrState): string {
  const ranks = computeRankings(state);
  const lines = ranks.map(
    (r) => `#${r.place} ${r.nickname}: ${r.distance}m`,
  );
  return `Rail Rush — ${lines.join(' · ') || 'Done'}`;
}

export function finishRound(state: RrState): void {
  // Freeze distances for any still-alive runners
  for (const r of Object.values(state.runners)) {
    if (r.alive) {
      r.distance = Math.floor(state.scroll + r.stagger);
    }
  }
  state.finished = true;
  state.rankings = computeRankings(state);
  state.resultsSummary = buildResultsSummary(state);
}

/**
 * Advance simulation by dtMs. Returns whether the round ended (all out).
 */
export function tickEngine(
  state: RrState,
  dtMs: number,
  now: number,
  rng: () => number = Math.random,
): { ended: boolean } {
  if (state.finished) return { ended: true };

  const dt = Math.max(0, dtMs) / 1000;
  state.speed = Math.min(MAX_SPEED, state.speed + SPEED_RAMP * dt);
  state.scroll += state.speed * dt;

  for (const r of Object.values(state.runners)) {
    if (r.alive) {
      r.distance = Math.floor(state.scroll + r.stagger);
    }
  }

  maybeSpawn(state, now, rng);
  pruneObstacles(state);

  for (const obstacle of state.obstacles) {
    for (const runner of Object.values(state.runners)) {
      if (checkObstacleHit(runner, obstacle, state.scroll)) {
        eliminate(runner, now, state.scroll);
      }
    }
  }

  // Drop obstacles that have been passed by everyone (optional cleanup already in prune)

  const anyAlive = Object.values(state.runners).some((r) => r.alive);
  if (!anyAlive && Object.keys(state.runners).length > 0) {
    finishRound(state);
    return { ended: true };
  }

  state.rankings = computeRankings(state);
  return { ended: false };
}

export function substateLabel(state: RrState, inTutorial: boolean): string {
  if (inTutorial) {
    return TUTORIAL_STEPS[state.tutorialStepIndex] ?? 'welcome';
  }
  if (state.finished) return 'finished';
  return 'racing';
}

export function flavorLine(contentMode: ContentMode): string {
  return contentMode === 'adult'
    ? 'Keep your cool on the rails.'
    : 'Stay on the sunny tracks!';
}

export function buildPublicState(
  state: RrState,
  inTutorial: boolean,
): RrPublicState {
  const step = inTutorial
    ? (TUTORIAL_STEPS[state.tutorialStepIndex] as RrTutorialStep)
    : null;
  const minVisible = state.scroll - 40;
  const maxVisible = state.scroll + VISIBLE_TRACK;
  return {
    gameId: 'rail-rush',
    tutorialStep: step,
    tutorialStepIndex: state.tutorialStepIndex,
    tutorialTotal: TUTORIAL_STEPS.length,
    scroll: state.scroll,
    speed: state.speed,
    runners: Object.values(state.runners).map((r) => ({
      playerId: r.playerId,
      nickname: r.nickname,
      avatarId: r.avatarId,
      lane: r.lane,
      stagger: r.stagger,
      distance: r.alive
        ? Math.floor(state.scroll + r.stagger)
        : r.distance,
      alive: r.alive,
    })),
    obstacles: state.obstacles
      .filter((o) => o.z >= minVisible && o.z <= maxVisible)
      .map((o) => ({ id: o.id, lane: o.lane, z: o.z })),
    rankings: state.rankings.length
      ? state.rankings
      : computeRankings(state),
    aliveCount: Object.values(state.runners).filter((r) => r.alive).length,
    finished: state.finished,
    flavor: inTutorial ? null : flavorLine(state.contentMode),
  };
}

export function buildPrivateState(
  state: RrState,
  playerId: string,
  phasePlaying: boolean,
): RrPrivateState {
  const runner = state.runners[playerId];
  return {
    gameId: 'rail-rush',
    myLane: runner?.lane ?? null,
    myDistance: runner
      ? runner.alive
        ? Math.floor(state.scroll + runner.stagger)
        : runner.distance
      : 0,
    alive: runner?.alive ?? false,
    canSteer: phasePlaying && !!runner?.alive && !state.finished,
  };
}

export const LANE_COUNT = 3;
/** Depth gap between staggered runners along the shared track. */
export const STAGGER_GAP = 40;
export const BASE_SPEED = 140;
export const SPEED_RAMP = 6;
export const MAX_SPEED = 320;
/** How far ahead of the lead runner obstacles spawn. */
export const SPAWN_AHEAD = 520;
export const SPAWN_INTERVAL_MS = 850;
export const HIT_DEPTH = 22;
export const VISIBLE_TRACK = 700;

export type RrTutorialStep = 'welcome' | 'lanes' | 'obstacles' | 'ready';

export const TUTORIAL_STEPS: RrTutorialStep[] = [
  'welcome',
  'lanes',
  'obstacles',
  'ready',
];

export interface RrRunner {
  playerId: string;
  nickname: string;
  avatarId: string;
  /** Lane index 0 (left) … 2 (right) */
  lane: number;
  /** Fixed stagger along the path (higher = slightly ahead on TV) */
  stagger: number;
  /** Distance survived (frozen on eliminate) */
  distance: number;
  alive: boolean;
  eliminatedAt: number | null;
}

export interface RrObstacle {
  id: string;
  lane: number;
  /** Absolute track position */
  z: number;
}

export interface RrRankEntry {
  playerId: string;
  nickname: string;
  avatarId: string;
  distance: number;
  place: number;
  alive: boolean;
}

export interface RrState {
  contentMode: 'family' | 'adult';
  tutorialStepIndex: number;
  /** Shared world scroll — increases while running */
  scroll: number;
  speed: number;
  startedAt: number;
  lastSpawnAt: number;
  nextObstacleId: number;
  runners: Record<string, RrRunner>;
  obstacles: RrObstacle[];
  finished: boolean;
  resultsSummary: string | null;
  rankings: RrRankEntry[];
}

export interface RrPublicRunner {
  playerId: string;
  nickname: string;
  avatarId: string;
  lane: number;
  stagger: number;
  distance: number;
  alive: boolean;
}

export interface RrPublicObstacle {
  id: string;
  lane: number;
  z: number;
}

export interface RrPublicState {
  gameId: 'rail-rush';
  tutorialStep: RrTutorialStep | null;
  tutorialStepIndex: number;
  tutorialTotal: number;
  scroll: number;
  speed: number;
  runners: RrPublicRunner[];
  obstacles: RrPublicObstacle[];
  rankings: RrRankEntry[];
  aliveCount: number;
  finished: boolean;
  flavor: string | null;
}

export interface RrPrivateState {
  gameId: 'rail-rush';
  myLane: number | null;
  myDistance: number;
  alive: boolean;
  canSteer: boolean;
}

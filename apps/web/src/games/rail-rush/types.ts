/** Client-side mirrors of Rail Rush public/private state. */

export type RrTutorialStep = 'welcome' | 'lanes' | 'obstacles' | 'ready';

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

export interface RrRankEntry {
  playerId: string;
  nickname: string;
  avatarId: string;
  distance: number;
  place: number;
  alive: boolean;
}

export interface RrPublicState {
  gameId: 'rail-rush';
  tutorialStep: string | null;
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

export const TUTORIAL_COPY: Record<string, { title: string; body: string }> = {
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

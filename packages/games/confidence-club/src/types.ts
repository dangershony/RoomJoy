import type { Confidence } from './scoring.js';

export type CcRoundPhase =
  | 'answering'
  | 'locked'
  | 'revising'
  | 'reveal';

export type CcTutorialStep =
  | 'welcome'
  | 'scoring'
  | 'answer'
  | 'confidence'
  | 'clue'
  | 'ready';

export const TUTORIAL_STEPS: CcTutorialStep[] = [
  'welcome',
  'scoring',
  'answer',
  'confidence',
  'clue',
  'ready',
];

export const QUESTIONS_PER_GAME = 6;

export const PHASE_MS = {
  answering: 45_000,
  locked: 2_000,
  revising: 30_000,
  reveal: 12_000,
} as const;

export interface PlayerRoundSubmission {
  initialOption: number | null;
  confidence: Confidence | null;
  /** Set when player submits revision (or explicitly keeps); null = no revision action */
  revisedOption: number | null;
  revisionSubmitted: boolean;
  points: number | null;
}

export interface QuestionPublic {
  id: string;
  category: string;
  difficulty: string;
  prompt: string;
  options: [string, string, string, string];
  index: number;
  total: number;
}

export interface RevealPlayerResult {
  playerId: string;
  nickname: string;
  finalOption: number | null;
  confidence: Confidence | null;
  changed: boolean;
  points: number;
  correct: boolean;
  missed: boolean;
}

export interface CcState {
  contentMode: 'family' | 'adult';
  seed: number;
  questionIds: string[];
  questionIndex: number;
  roundPhase: CcRoundPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  tutorialStepIndex: number;
  /** Cumulative scores — may go negative */
  scores: Record<string, number>;
  /** Per-player current-round private submissions (server-only detail) */
  submissions: Record<string, PlayerRoundSubmission>;
  /** Cached public question (no correct index until reveal) */
  currentQuestion: QuestionPublic | null;
  /** Only populated during reveal */
  correctIndex: number | null;
  clue: string | null;
  explanation: string | null;
  revealResults: RevealPlayerResult[] | null;
  finished: boolean;
  resultsSummary: string | null;
}

/** Sanitized public snapshot — never includes other players' unrevealed answers */
export interface CcPublicState {
  gameId: 'confidence-club';
  tutorialStep: CcTutorialStep | null;
  tutorialStepIndex: number;
  tutorialTotal: number;
  roundPhase: CcRoundPhase | null;
  question: QuestionPublic | null;
  /** Shown from revising onward */
  clue: string | null;
  /** Reveal only */
  correctIndex: number | null;
  explanation: string | null;
  revealResults: RevealPlayerResult[] | null;
  submittedCount: number;
  playerCount: number;
  phaseEndsAt: number | null;
  scores: { playerId: string; nickname: string; score: number }[];
  questionIndex: number;
  totalQuestions: number;
  finished: boolean;
}

export interface CcPrivateState {
  gameId: 'confidence-club';
  myInitialOption: number | null;
  myConfidence: Confidence | null;
  myRevisedOption: number | null;
  revisionSubmitted: boolean;
  hasInitialSubmission: boolean;
  canSubmitAnswer: boolean;
  canRevise: boolean;
  myPointsThisRound: number | null;
}

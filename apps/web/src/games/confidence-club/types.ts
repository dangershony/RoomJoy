/** Client-side mirrors of CC public/private state (keep in sync with game package). */

export type CcRoundPhase = 'answering' | 'locked' | 'revising' | 'reveal';

export interface CcQuestionPublic {
  id: string;
  category: string;
  difficulty: string;
  prompt: string;
  options: [string, string, string, string];
  index: number;
  total: number;
}

export interface CcRevealPlayerResult {
  playerId: string;
  nickname: string;
  finalOption: number | null;
  confidence: 1 | 2 | 3 | null;
  changed: boolean;
  points: number;
  correct: boolean;
  missed: boolean;
}

export interface CcPublicState {
  gameId: 'confidence-club';
  tutorialStep: string | null;
  tutorialStepIndex: number;
  tutorialTotal: number;
  roundPhase: CcRoundPhase | null;
  question: CcQuestionPublic | null;
  clue: string | null;
  correctIndex: number | null;
  explanation: string | null;
  revealResults: CcRevealPlayerResult[] | null;
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
  myConfidence: 1 | 2 | 3 | null;
  myRevisedOption: number | null;
  revisionSubmitted: boolean;
  hasInitialSubmission: boolean;
  canSubmitAnswer: boolean;
  canRevise: boolean;
  myPointsThisRound: number | null;
}

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

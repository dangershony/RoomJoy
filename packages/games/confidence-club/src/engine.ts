/**
 * Confidence Club pure engine — no React/Colyseus.
 */
import {
  getQuestionById,
  pickQuestions,
  type ConfidenceQuestion,
} from '@roomjoy/content';
import type { ContentMode } from '@roomjoy/protocol';
import { computePlacements, scoreRound, type Confidence } from './scoring.js';
import {
  PHASE_MS,
  QUESTIONS_PER_GAME,
  TUTORIAL_STEPS,
  type CcPrivateState,
  type CcPublicState,
  type CcRoundPhase,
  type CcState,
  type PlayerRoundSubmission,
  type QuestionPublic,
  type RevealPlayerResult,
} from './types.js';

export interface EnginePlayer {
  id: string;
  nickname: string;
}

function emptySubmission(): PlayerRoundSubmission {
  return {
    initialOption: null,
    confidence: null,
    revisedOption: null,
    revisionSubmitted: false,
    points: null,
  };
}

function toPublicQuestion(
  q: ConfidenceQuestion,
  index: number,
  total: number,
): QuestionPublic {
  return {
    id: q.id,
    category: q.category,
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: q.options,
    index,
    total,
  };
}

export function createCcState(
  contentMode: ContentMode,
  seed = Date.now(),
): CcState {
  const picked = pickQuestions(contentMode, QUESTIONS_PER_GAME, seed);
  return {
    contentMode,
    seed,
    questionIds: picked.map((q) => q.id),
    questionIndex: 0,
    roundPhase: 'answering',
    phaseStartedAt: 0,
    phaseEndsAt: 0,
    tutorialStepIndex: 0,
    scores: {},
    submissions: {},
    currentQuestion: null,
    correctIndex: null,
    clue: null,
    explanation: null,
    revealResults: null,
    finished: false,
    resultsSummary: null,
  };
}

function ensurePlayerSlots(state: CcState, players: EnginePlayer[]): void {
  for (const p of players) {
    if (state.scores[p.id] === undefined) state.scores[p.id] = 0;
    if (!state.submissions[p.id]) state.submissions[p.id] = emptySubmission();
  }
}

function loadQuestion(state: CcState): ConfidenceQuestion {
  const id = state.questionIds[state.questionIndex]!;
  const q = getQuestionById(state.contentMode, id);
  if (!q) throw new Error(`Missing question ${id}`);
  return q;
}

export function beginTutorial(state: CcState, players: EnginePlayer[]): void {
  ensurePlayerSlots(state, players);
  state.tutorialStepIndex = 0;
  state.finished = false;
  state.resultsSummary = null;
  state.currentQuestion = null;
  state.clue = null;
  state.correctIndex = null;
  state.explanation = null;
  state.revealResults = null;
}

export function tutorialAdvance(state: CcState): boolean {
  if (state.tutorialStepIndex < TUTORIAL_STEPS.length - 1) {
    state.tutorialStepIndex += 1;
    return true;
  }
  return false;
}

export function beginRound(
  state: CcState,
  players: EnginePlayer[],
  now: number,
): void {
  ensurePlayerSlots(state, players);
  state.questionIndex = 0;
  state.finished = false;
  state.resultsSummary = null;
  startQuestion(state, players, now);
}

function startQuestion(
  state: CcState,
  players: EnginePlayer[],
  now: number,
): void {
  ensurePlayerSlots(state, players);
  const q = loadQuestion(state);
  state.currentQuestion = toPublicQuestion(
    q,
    state.questionIndex,
    QUESTIONS_PER_GAME,
  );
  state.clue = null;
  state.correctIndex = null;
  state.explanation = null;
  state.revealResults = null;
  state.submissions = {};
  for (const p of players) {
    state.submissions[p.id] = emptySubmission();
    if (state.scores[p.id] === undefined) state.scores[p.id] = 0;
  }
  setPhase(state, 'answering', now);
}

function setPhase(state: CcState, phase: CcRoundPhase, now: number): void {
  state.roundPhase = phase;
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + PHASE_MS[phase];
}

export function submitAnswer(
  state: CcState,
  playerId: string,
  optionIndex: number,
  confidence: number,
): { ok: true } | { ok: false; error: string } {
  if (state.finished) return { ok: false, error: 'Game finished' };
  if (state.roundPhase !== 'answering') {
    return { ok: false, error: 'Not accepting answers' };
  }
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
    return { ok: false, error: 'Invalid option' };
  }
  if (confidence !== 1 && confidence !== 2 && confidence !== 3) {
    return { ok: false, error: 'Invalid confidence' };
  }
  const sub = state.submissions[playerId];
  if (!sub) return { ok: false, error: 'Unknown player' };
  // Allow changing until lock
  sub.initialOption = optionIndex;
  sub.confidence = confidence as Confidence;
  return { ok: true };
}

export function reviseAnswer(
  state: CcState,
  playerId: string,
  optionIndex: number,
): { ok: true } | { ok: false; error: string } {
  if (state.finished) return { ok: false, error: 'Game finished' };
  if (state.roundPhase !== 'revising') {
    return { ok: false, error: 'Not accepting revisions' };
  }
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
    return { ok: false, error: 'Invalid option' };
  }
  const sub = state.submissions[playerId];
  if (!sub) return { ok: false, error: 'Unknown player' };
  if (sub.initialOption === null || sub.confidence === null) {
    return { ok: false, error: 'No initial submission — cannot revise' };
  }
  sub.revisedOption = optionIndex;
  sub.revisionSubmitted = true;
  return { ok: true };
}

function finalOption(sub: PlayerRoundSubmission): number | null {
  if (sub.initialOption === null) return null;
  if (sub.revisionSubmitted && sub.revisedOption !== null) {
    return sub.revisedOption;
  }
  return sub.initialOption;
}

function computeReveal(
  state: CcState,
  players: EnginePlayer[],
): RevealPlayerResult[] {
  const q = loadQuestion(state);
  const results: RevealPlayerResult[] = [];
  for (const p of players) {
    const sub = state.submissions[p.id] ?? emptySubmission();
    const hasInitial =
      sub.initialOption !== null && sub.confidence !== null;
    const fin = finalOption(sub);
    const changed =
      hasInitial &&
      sub.revisionSubmitted &&
      sub.revisedOption !== null &&
      sub.revisedOption !== sub.initialOption;
    const points = scoreRound({
      hasInitialSubmission: hasInitial,
      confidence: (sub.confidence ?? 1) as Confidence,
      finalOptionIndex: fin ?? -1,
      correctIndex: q.correctIndex,
      changedAnswer: !!changed,
    });
    sub.points = points;
    if (hasInitial) {
      state.scores[p.id] = (state.scores[p.id] ?? 0) + points;
    }
    results.push({
      playerId: p.id,
      nickname: p.nickname,
      finalOption: fin,
      confidence: sub.confidence,
      changed: !!changed,
      points,
      correct: hasInitial && fin === q.correctIndex,
      missed: !hasInitial,
    });
  }
  return results;
}

export function advancePhase(
  state: CcState,
  players: EnginePlayer[],
  now: number,
): { ended: boolean } {
  if (state.finished) return { ended: true };

  switch (state.roundPhase) {
    case 'answering': {
      setPhase(state, 'locked', now);
      return { ended: false };
    }
    case 'locked': {
      const q = loadQuestion(state);
      state.clue = q.clue;
      setPhase(state, 'revising', now);
      return { ended: false };
    }
    case 'revising': {
      const q = loadQuestion(state);
      state.correctIndex = q.correctIndex;
      state.explanation = q.explanation;
      state.clue = q.clue;
      state.revealResults = computeReveal(state, players);
      setPhase(state, 'reveal', now);
      return { ended: false };
    }
    case 'reveal': {
      if (state.questionIndex + 1 >= QUESTIONS_PER_GAME) {
        finishGame(state, players);
        return { ended: true };
      }
      state.questionIndex += 1;
      startQuestion(state, players, now);
      return { ended: false };
    }
    default:
      return { ended: false };
  }
}

function finishGame(state: CcState, players: EnginePlayer[]): void {
  state.finished = true;
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.nickname]));
  const placements = computePlacements(state.scores);
  const lines = placements.map((pl) => {
    const name = nameById[pl.playerId] ?? pl.playerId.slice(0, 6);
    return `#${pl.place} ${name}: ${pl.score}`;
  });
  state.resultsSummary = `Confidence Club — ${lines.join(' · ') || 'No scores'}`;
}

/** Tick timers; returns whether game just ended. */
export function tickEngine(
  state: CcState,
  players: EnginePlayer[],
  now: number,
): { ended: boolean; phaseChanged: boolean } {
  if (state.finished) return { ended: true, phaseChanged: false };
  if (!state.phaseEndsAt || now < state.phaseEndsAt) {
    return { ended: false, phaseChanged: false };
  }
  const before = state.roundPhase;
  const { ended } = advancePhase(state, players, now);
  return { ended, phaseChanged: ended || state.roundPhase !== before };
}

/** Auto-advance answering early if everyone submitted. */
export function maybeEarlyLock(
  state: CcState,
  players: EnginePlayer[],
  now: number,
): boolean {
  if (state.roundPhase !== 'answering') return false;
  if (players.length === 0) return false;
  const allIn = players.every((p) => {
    const s = state.submissions[p.id];
    return s && s.initialOption !== null && s.confidence !== null;
  });
  if (!allIn) return false;
  // Short grace then lock
  if (state.phaseEndsAt - now > 3_000) {
    state.phaseEndsAt = now + 1_500;
  }
  return true;
}

export function buildPublicState(
  state: CcState,
  players: EnginePlayer[],
  inTutorial: boolean,
): CcPublicState {
  const scores = players.map((p) => ({
    playerId: p.id,
    nickname: p.nickname,
    score: state.scores[p.id] ?? 0,
  }));
  scores.sort((a, b) => b.score - a.score);

  let submittedCount = 0;
  for (const p of players) {
    const s = state.submissions[p.id];
    if (s && s.initialOption !== null && s.confidence !== null) {
      submittedCount += 1;
    }
  }

  const showClue =
    !inTutorial &&
    (state.roundPhase === 'revising' || state.roundPhase === 'reveal');
  const showReveal = !inTutorial && state.roundPhase === 'reveal';

  return {
    gameId: 'confidence-club',
    tutorialStep: inTutorial
      ? TUTORIAL_STEPS[state.tutorialStepIndex]!
      : null,
    tutorialStepIndex: state.tutorialStepIndex,
    tutorialTotal: TUTORIAL_STEPS.length,
    roundPhase: inTutorial ? null : state.roundPhase,
    question: inTutorial ? null : state.currentQuestion,
    clue: showClue ? state.clue : null,
    correctIndex: showReveal ? state.correctIndex : null,
    explanation: showReveal ? state.explanation : null,
    revealResults: showReveal ? state.revealResults : null,
    submittedCount,
    playerCount: players.length,
    phaseEndsAt: inTutorial ? null : state.phaseEndsAt,
    scores,
    questionIndex: state.questionIndex,
    totalQuestions: QUESTIONS_PER_GAME,
    finished: state.finished,
  };
}

export function buildPrivateState(
  state: CcState,
  playerId: string,
  inTutorial: boolean,
): CcPrivateState {
  const sub = state.submissions[playerId] ?? emptySubmission();
  const hasInitial =
    sub.initialOption !== null && sub.confidence !== null;
  return {
    gameId: 'confidence-club',
    myInitialOption: sub.initialOption,
    myConfidence: sub.confidence,
    myRevisedOption: sub.revisedOption,
    revisionSubmitted: sub.revisionSubmitted,
    hasInitialSubmission: hasInitial,
    canSubmitAnswer:
      !inTutorial && state.roundPhase === 'answering' && !state.finished,
    canRevise:
      !inTutorial &&
      state.roundPhase === 'revising' &&
      hasInitial &&
      !state.finished,
    myPointsThisRound: sub.points,
  };
}

export function substateLabel(state: CcState, inTutorial: boolean): string {
  if (inTutorial) {
    return `tutorial_${TUTORIAL_STEPS[state.tutorialStepIndex]}`;
  }
  if (state.finished) return 'finished';
  return `q${state.questionIndex + 1}_${state.roundPhase}`;
}

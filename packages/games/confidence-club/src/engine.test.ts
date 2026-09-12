import { describe, it, expect } from 'vitest';
import {
  advancePhase,
  beginRound,
  beginTutorial,
  buildPrivateState,
  buildPublicState,
  createCcState,
  reviseAnswer,
  submitAnswer,
  tutorialAdvance,
} from './engine.js';
import { QUESTIONS_PER_GAME } from './types.js';

const players = [
  { id: 'p1', nickname: 'Ada' },
  { id: 'p2', nickname: 'Bob' },
];

describe('phase transitions', () => {
  it('answering → locked → revising → reveal → next question', () => {
    const state = createCcState('family', 99);
    beginRound(state, players, 1_000);
    expect(state.roundPhase).toBe('answering');
    expect(state.currentQuestion).toBeTruthy();
    expect(state.clue).toBeNull();
    expect(state.correctIndex).toBeNull();

    advancePhase(state, players, 2_000);
    expect(state.roundPhase).toBe('locked');

    advancePhase(state, players, 3_000);
    expect(state.roundPhase).toBe('revising');
    expect(state.clue).toBeTruthy();
    expect(state.correctIndex).toBeNull();

    advancePhase(state, players, 4_000);
    expect(state.roundPhase).toBe('reveal');
    expect(state.correctIndex).toBeTypeOf('number');
    expect(state.explanation).toBeTruthy();

    advancePhase(state, players, 5_000);
    expect(state.questionIndex).toBe(1);
    expect(state.roundPhase).toBe('answering');
  });

  it('finishes after QUESTIONS_PER_GAME reveals', () => {
    const state = createCcState('family', 7);
    beginRound(state, players, 0);
    for (let q = 0; q < QUESTIONS_PER_GAME; q++) {
      submitAnswer(state, 'p1', 0, 1);
      submitAnswer(state, 'p2', 0, 1);
      advancePhase(state, players, q * 1000 + 1); // lock
      advancePhase(state, players, q * 1000 + 2); // revise
      advancePhase(state, players, q * 1000 + 3); // reveal
      const { ended } = advancePhase(state, players, q * 1000 + 4);
      if (q < QUESTIONS_PER_GAME - 1) {
        expect(ended).toBe(false);
      } else {
        expect(ended).toBe(true);
        expect(state.finished).toBe(true);
        expect(state.resultsSummary).toMatch(/Confidence Club/);
      }
    }
  });
});

describe('submissions & privacy', () => {
  it('late submit after lock rejected; revise without initial rejected', () => {
    const state = createCcState('family', 3);
    beginRound(state, players, 0);
    advancePhase(state, players, 1);
    expect(submitAnswer(state, 'p1', 1, 2).ok).toBe(false);

    // restart answering
    const state2 = createCcState('family', 4);
    beginRound(state2, players, 0);
    advancePhase(state2, players, 1);
    advancePhase(state2, players, 2); // revising
    expect(reviseAnswer(state2, 'p1', 2).ok).toBe(false);
  });

  it('no revision submission keeps original answer', () => {
    const state = createCcState('family', 5);
    beginRound(state, players, 0);
    const correct = state.currentQuestion!;
    // We don't know correct yet on public — submit option 0
    submitAnswer(state, 'p1', 0, 2);
    advancePhase(state, players, 1);
    advancePhase(state, players, 2);
    // no revise
    advancePhase(state, players, 3);
    const result = state.revealResults!.find((r) => r.playerId === 'p1')!;
    expect(result.finalOption).toBe(0);
    expect(result.changed).toBe(false);
    void correct;
  });

  it('private state never includes other players answers', () => {
    const state = createCcState('family', 11);
    beginRound(state, players, 0);
    submitAnswer(state, 'p1', 2, 3);
    submitAnswer(state, 'p2', 1, 1);
    const priv1 = buildPrivateState(state, 'p1', false);
    const priv2 = buildPrivateState(state, 'p2', false);
    expect(priv1.myInitialOption).toBe(2);
    expect(priv2.myInitialOption).toBe(1);
    expect(JSON.stringify(priv1)).not.toContain('"myInitialOption":1');
    // public before reveal has no correct / no per-player answers
    const pub = buildPublicState(state, players, false);
    expect(pub.correctIndex).toBeNull();
    expect(pub.revealResults).toBeNull();
    expect(pub.clue).toBeNull();
  });

  it('missed initial submission scores zero and cannot revise', () => {
    const state = createCcState('family', 12);
    beginRound(state, players, 0);
    submitAnswer(state, 'p1', 0, 3);
    // p2 misses
    advancePhase(state, players, 1);
    advancePhase(state, players, 2);
    expect(reviseAnswer(state, 'p2', 0).ok).toBe(false);
    advancePhase(state, players, 3);
    const r2 = state.revealResults!.find((r) => r.playerId === 'p2')!;
    expect(r2.missed).toBe(true);
    expect(r2.points).toBe(0);
  });
});

describe('tutorial', () => {
  it('advances one step at a time', () => {
    const state = createCcState('family', 1);
    beginTutorial(state, players);
    expect(buildPublicState(state, players, true).tutorialStep).toBe('welcome');
    tutorialAdvance(state);
    expect(buildPublicState(state, players, true).tutorialStep).toBe('scoring');
  });
});

describe('family vs adult pack selection', () => {
  it('uses different question ids for family vs adult', () => {
    const fam = createCcState('family', 42);
    const adu = createCcState('adult', 42);
    expect(fam.questionIds[0]).not.toBe(adu.questionIds[0]);
    expect(fam.contentMode).toBe('family');
    expect(adu.contentMode).toBe('adult');
  });
});

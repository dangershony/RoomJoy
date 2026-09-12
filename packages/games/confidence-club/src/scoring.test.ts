import { describe, it, expect } from 'vitest';
import { computePlacements, scoreRound } from './scoring.js';

describe('scoreRound', () => {
  it('correct without change: confidence × 100', () => {
    expect(
      scoreRound({
        hasInitialSubmission: true,
        confidence: 3,
        finalOptionIndex: 1,
        correctIndex: 1,
        changedAnswer: false,
      }),
    ).toBe(300);
    expect(
      scoreRound({
        hasInitialSubmission: true,
        confidence: 1,
        finalOptionIndex: 0,
        correctIndex: 0,
        changedAnswer: false,
      }),
    ).toBe(100);
  });

  it('correct after change: confidence × 50', () => {
    expect(
      scoreRound({
        hasInitialSubmission: true,
        confidence: 2,
        finalOptionIndex: 3,
        correctIndex: 3,
        changedAnswer: true,
      }),
    ).toBe(100);
  });

  it('incorrect: −confidence × 50', () => {
    expect(
      scoreRound({
        hasInitialSubmission: true,
        confidence: 3,
        finalOptionIndex: 0,
        correctIndex: 2,
        changedAnswer: false,
      }),
    ).toBe(-150);
    expect(
      scoreRound({
        hasInitialSubmission: true,
        confidence: 1,
        finalOptionIndex: 1,
        correctIndex: 0,
        changedAnswer: true,
      }),
    ).toBe(-50);
  });

  it('no initial submission: zero', () => {
    expect(
      scoreRound({
        hasInitialSubmission: false,
        confidence: 3,
        finalOptionIndex: 1,
        correctIndex: 1,
        changedAnswer: false,
      }),
    ).toBe(0);
  });

  it('scores may go negative (placement still works)', () => {
    const places = computePlacements({ a: -50, b: -50, c: 100 });
    expect(places.find((p) => p.playerId === 'c')!.place).toBe(1);
    expect(places.find((p) => p.playerId === 'a')!.place).toBe(2);
    expect(places.find((p) => p.playerId === 'b')!.place).toBe(2);
  });
});

describe('computePlacements', () => {
  it('equal finals share placing (1224)', () => {
    const p = computePlacements({ a: 10, b: 10, c: 5, d: 5 });
    expect(p.find((x) => x.playerId === 'a')!.place).toBe(1);
    expect(p.find((x) => x.playerId === 'b')!.place).toBe(1);
    expect(p.find((x) => x.playerId === 'c')!.place).toBe(3);
    expect(p.find((x) => x.playerId === 'd')!.place).toBe(3);
  });
});

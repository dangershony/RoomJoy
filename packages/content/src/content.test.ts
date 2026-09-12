import { describe, it, expect } from 'vitest';
import {
  clueDoesNotRevealAnswer,
  getAdultPack,
  getConfidenceClubPack,
  getFamilyPack,
  packStats,
  pickQuestions,
} from './index.js';

describe('content packs', () => {
  it('validates family and adult packs with ≥30 each and ≥60 total', () => {
    const stats = packStats();
    expect(stats.family).toBeGreaterThanOrEqual(30);
    expect(stats.adult).toBeGreaterThanOrEqual(30);
    expect(stats.total).toBeGreaterThanOrEqual(60);
  });

  it('selects family vs adult by content mode', () => {
    const fam = getConfidenceClubPack('family');
    const adu = getConfidenceClubPack('adult');
    expect(fam.contentMode).toBe('family');
    expect(adu.contentMode).toBe('adult');
    expect(fam.packId).not.toBe(adu.packId);
    expect(fam.questions[0]!.id).not.toBe(adu.questions[0]!.id);
  });

  it('every question has required metadata and non-revealing clue', () => {
    for (const pack of [getFamilyPack(), getAdultPack()]) {
      expect(pack.version).toBeTruthy();
      expect(pack.gameId).toBe('confidence-club');
      for (const q of pack.questions) {
        expect(q.options).toHaveLength(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThanOrEqual(3);
        expect(q.sourceUrl).toMatch(/^https?:\/\//);
        expect(q.verificationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(clueDoesNotRevealAnswer(q)).toBe(true);
      }
    }
  });

  it('pickQuestions returns distinct ids of requested count', () => {
    const qs = pickQuestions('family', 6, 42);
    expect(qs).toHaveLength(6);
    expect(new Set(qs.map((q) => q.id)).size).toBe(6);
    const again = pickQuestions('family', 6, 42);
    expect(again.map((q) => q.id)).toEqual(qs.map((q) => q.id));
  });
});

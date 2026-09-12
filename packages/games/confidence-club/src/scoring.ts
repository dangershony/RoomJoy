/** Pure scoring for Confidence Club — server-authoritative, framework-free. */

export type Confidence = 1 | 2 | 3;

export interface ScoreInput {
  /** Player submitted an initial answer+confidence during answering phase */
  hasInitialSubmission: boolean;
  confidence: Confidence;
  /** Final option index after revision window (or initial if no revision) */
  finalOptionIndex: number;
  correctIndex: number;
  /** True if revised option differs from initial */
  changedAnswer: boolean;
}

/**
 * Scoring rules:
 * - Correct without changing: confidence × 100
 * - Correct after changing: confidence × 50
 * - Incorrect: −confidence × 50
 * - No initial submission: 0 (and no revision allowed by rules engine)
 */
export function scoreRound(input: ScoreInput): number {
  if (!input.hasInitialSubmission) return 0;
  const correct = input.finalOptionIndex === input.correctIndex;
  if (correct) {
    return input.changedAnswer ? input.confidence * 50 : input.confidence * 100;
  }
  return -input.confidence * 50;
}

export interface Placement {
  playerId: string;
  score: number;
  place: number; // 1-based; ties share place
}

/** Equal finals share placing (1224 style: two tied for 1st → next is 3rd). */
export function computePlacements(
  scores: Record<string, number>,
): Placement[] {
  const entries = Object.entries(scores).sort((a, b) => b[1]! - a[1]!);
  const out: Placement[] = [];
  let i = 0;
  while (i < entries.length) {
    const score = entries[i]![1]!;
    let j = i;
    while (j < entries.length && entries[j]![1] === score) j++;
    const place = i + 1;
    for (let k = i; k < j; k++) {
      out.push({ playerId: entries[k]![0]!, score, place });
    }
    i = j;
  }
  return out;
}

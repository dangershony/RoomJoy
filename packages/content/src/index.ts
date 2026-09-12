/**
 * RoomJoy content packs — Confidence Club question decks (versioned JSON).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentMode } from '@roomjoy/protocol';
import {
  ContentPackSchema,
  clueDoesNotRevealAnswer,
  type ConfidenceQuestion,
  type ContentPack,
} from './schema.js';

export * from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));

function loadPack(filename: string): ContentPack {
  const raw = JSON.parse(readFileSync(join(here, 'packs', filename), 'utf8'));
  const pack = ContentPackSchema.parse(raw);
  for (const q of pack.questions) {
    if (!clueDoesNotRevealAnswer(q)) {
      throw new Error(`Clue reveals answer for question ${q.id}`);
    }
  }
  const ids = new Set<string>();
  for (const q of pack.questions) {
    if (ids.has(q.id)) throw new Error(`Duplicate question id: ${q.id}`);
    ids.add(q.id);
  }
  return pack;
}

let familyPack: ContentPack | null = null;
let adultPack: ContentPack | null = null;

export function getFamilyPack(): ContentPack {
  if (!familyPack) familyPack = loadPack('family-v1.json');
  return familyPack;
}

export function getAdultPack(): ContentPack {
  if (!adultPack) adultPack = loadPack('adult-v1.json');
  return adultPack;
}

export function getConfidenceClubPack(mode: ContentMode): ContentPack {
  return mode === 'adult' ? getAdultPack() : getFamilyPack();
}

export function getQuestionById(
  mode: ContentMode,
  id: string,
): ConfidenceQuestion | undefined {
  return getConfidenceClubPack(mode).questions.find((q) => q.id === id);
}

/** Deterministic shuffle (Fisher–Yates) with a numeric seed. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function pickQuestions(
  mode: ContentMode,
  count: number,
  seed = Date.now(),
): ConfidenceQuestion[] {
  const pack = getConfidenceClubPack(mode);
  if (pack.questions.length < count) {
    throw new Error(
      `Pack ${pack.packId} has ${pack.questions.length} questions; need ${count}`,
    );
  }
  return seededShuffle(pack.questions, seed).slice(0, count);
}

export function packStats(): { family: number; adult: number; total: number } {
  const family = getFamilyPack().questions.length;
  const adult = getAdultPack().questions.length;
  return { family, adult, total: family + adult };
}

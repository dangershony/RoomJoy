import { z } from 'zod';

export const QuestionCategorySchema = z.enum([
  'general_knowledge',
  'numerical_estimation',
  'logical_reasoning',
  'ordering',
]);

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

export const ConfidenceQuestionSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9_:-]+$/i),
  category: QuestionCategorySchema,
  difficulty: DifficultySchema,
  prompt: z.string().min(8).max(400),
  options: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  clue: z.string().min(8).max(300),
  explanation: z.string().min(8).max(500),
  sourceUrl: z.string().url(),
  verificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ContentPackSchema = z.object({
  version: z.string().min(1),
  packId: z.string().min(1),
  gameId: z.literal('confidence-club'),
  contentMode: z.enum(['family', 'adult']),
  locale: z.string().default('en'),
  questions: z.array(ConfidenceQuestionSchema).min(1),
});

export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type ConfidenceQuestion = z.infer<typeof ConfidenceQuestionSchema>;
export type ContentPack = z.infer<typeof ContentPackSchema>;

/** Clue must not contain the correct option text verbatim (case-insensitive). */
export function clueDoesNotRevealAnswer(q: ConfidenceQuestion): boolean {
  const clue = q.clue.toLowerCase();
  const correct = q.options[q.correctIndex].toLowerCase().trim();
  if (correct.length >= 4 && clue.includes(correct)) return false;
  // Also reject if clue equals option after stripping punctuation
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nClue = normalize(q.clue);
  const nCorrect = normalize(q.options[q.correctIndex]);
  if (nCorrect.length >= 5 && nClue.includes(nCorrect)) return false;
  return true;
}

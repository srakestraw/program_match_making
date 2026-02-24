export const traitCategories = [
  "ACADEMIC",
  "INTERPERSONAL",
  "MOTIVATION",
  "EXPERIENCE",
  "LEADERSHIP",
  "PROBLEM_SOLVING"
] as const;

export const programTraitPriorityBuckets = [
  "CRITICAL",
  "VERY_IMPORTANT",
  "IMPORTANT",
  "NICE_TO_HAVE"
] as const;

export const tonePresets = ["FRIENDLY", "ENCOURAGING", "DIRECT", "PROFESSIONAL", "PLAYFUL"] as const;

export const traitQuestionTypes = ["CHAT", "QUIZ"] as const;

export type TraitCategory = (typeof traitCategories)[number];
export type ProgramTraitPriorityBucket = (typeof programTraitPriorityBuckets)[number];
export type TonePreset = (typeof tonePresets)[number];
export type TraitQuestionType = (typeof traitQuestionTypes)[number];

export type Trait = {
  id: string;
  name: string;
  category: TraitCategory;
  definition: string | null;
  rubricScaleMin: number;
  rubricScaleMax: number;
  rubricPositiveSignals: string | null;
  rubricNegativeSignals: string | null;
  rubricFollowUps: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TraitQuestion = {
  id: string;
  traitId: string;
  type: TraitQuestionType;
  prompt: string;
  optionsJson: string[] | null;
  scoringHints: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Program = {
  id: string;
  name: string;
  description: string | null;
  degreeLevel: string | null;
  department: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProgramTrait = {
  id: string;
  programId: string;
  traitId: string;
  bucket: ProgramTraitPriorityBucket;
  sortOrder: number;
  notes: string | null;
};

export type BrandVoice = {
  id: string;
  name: string;
  tonePreset: TonePreset;
  doList: string | null;
  dontList: string | null;
  samplePhrases: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScoringOutput = {
  overallScore: number | null;
  perTrait: Array<{ traitId: string; score: number; weight: number }>;
};

export type ScoringInput = {
  perTraitRawScores?: Array<{ traitId: string; score: number; bucket: ProgramTraitPriorityBucket }>;
  bucketWeights?: Partial<Record<ProgramTraitPriorityBucket, number>>;
};

export type ProgramTraitBoardState = Record<ProgramTraitPriorityBucket, string[]>;
export type ProgramTraitRowInput = {
  traitId: string;
  bucket: ProgramTraitPriorityBucket;
  sortOrder: number;
};

const defaultBucketWeights: Record<ProgramTraitPriorityBucket, number> = {
  CRITICAL: 1,
  VERY_IMPORTANT: 0.75,
  IMPORTANT: 0.5,
  NICE_TO_HAVE: 0.25
};

export const scoreCandidateSession = (input: ScoringInput = {}): ScoringOutput => {
  const scores = input.perTraitRawScores ?? [];
  const weights = { ...defaultBucketWeights, ...(input.bucketWeights ?? {}) };

  if (scores.length === 0) {
    return { overallScore: null, perTrait: [] };
  }

  const perTrait = scores.map((item) => ({
    traitId: item.traitId,
    score: item.score,
    weight: weights[item.bucket]
  }));

  const weightedTotal = perTrait.reduce((acc, item) => acc + item.score * item.weight, 0);
  const weightTotal = perTrait.reduce((acc, item) => acc + item.weight, 0);

  return {
    overallScore: weightTotal > 0 ? weightedTotal / weightTotal : null,
    perTrait
  };
};

export const boardStateToProgramTraitRows = (board: ProgramTraitBoardState): ProgramTraitRowInput[] =>
  programTraitPriorityBuckets.flatMap((bucket) =>
    (board[bucket] ?? []).map((traitId, index) => ({
      traitId,
      bucket,
      sortOrder: index
    }))
  );

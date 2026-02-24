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

export const brandVoiceTones = ["friendly", "encouraging", "direct", "professional", "playful"] as const;
export const brandVoiceStyleFlagOptions = [
  "clear",
  "credible",
  "supportive",
  "future_focused",
  "empathetic",
  "outcome_oriented",
  "concise"
] as const;
export const brandVoiceAvoidFlagOptions = [
  "jargon_heavy",
  "overly_salesy",
  "too_casual",
  "impersonal",
  "pushy",
  "vague"
] as const;
export const brandVoiceSampleTypes = ["headline", "cta", "email_intro", "description"] as const;

export const traitQuestionTypes = ["CHAT", "QUIZ"] as const;

export type TraitCategory = (typeof traitCategories)[number];
export type ProgramTraitPriorityBucket = (typeof programTraitPriorityBuckets)[number];
export type TraitQuestionType = (typeof traitQuestionTypes)[number];
export type BrandVoiceTone = (typeof brandVoiceTones)[number];
export type BrandVoiceSampleType = (typeof brandVoiceSampleTypes)[number];

export type ToneProfile = {
  formality: number;
  warmth: number;
  directness: number;
  confidence: number;
  energy: number;
};

export type CanonicalExample = {
  id: string;
  type: BrandVoiceSampleType;
  text: string;
  pinned: boolean;
};

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
  primaryTone: BrandVoiceTone;
  toneModifiers: string[];
  toneProfile: ToneProfile;
  styleFlags: string[];
  avoidFlags: string[];
  canonicalExamples: CanonicalExample[];
  createdAt: string;
  updatedAt: string;
};

export const defaultToneProfile: ToneProfile = {
  formality: 75,
  warmth: 60,
  directness: 65,
  confidence: 70,
  energy: 55
};

export const defaultStyleFlags = ["clear", "credible", "supportive", "future_focused"] as const;
export const defaultAvoidFlags = ["jargon_heavy", "overly_salesy", "impersonal"] as const;

export type BrandVoicePreviewInput = {
  name: string;
  primaryTone: string;
  toneModifiers: string[];
  toneProfile: ToneProfile;
  styleFlags: string[];
  avoidFlags: string[];
  seedText?: string;
};

export type BrandVoicePreviewSamples = {
  headline: string;
  cta: string;
  email_intro: string;
  description: string;
};

const toBand = (value: number) => {
  if (value >= 70) return "high";
  if (value <= 35) return "low";
  return "mid";
};

const cleanSeed = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "student success";
};

export const generateBrandVoicePreview = (input: BrandVoicePreviewInput): BrandVoicePreviewSamples => {
  const seed = cleanSeed(input.seedText);
  const formality = toBand(input.toneProfile.formality);
  const warmth = toBand(input.toneProfile.warmth);
  const directness = toBand(input.toneProfile.directness);
  const confidence = toBand(input.toneProfile.confidence);
  const energy = toBand(input.toneProfile.energy);

  const opener = formality === "high" ? "A practical path to" : formality === "low" ? "A smart way to" : "A clear path to";
  const confidenceWord = confidence === "high" ? "with confidence" : confidence === "low" ? "step by step" : "with clarity";
  const warmthWord = warmth === "high" ? "supportive" : warmth === "low" ? "focused" : "welcoming";
  const cadence = energy === "high" ? "Move fast." : energy === "low" ? "Take your time." : "Move with purpose.";
  const action = directness === "high" ? "Apply now" : directness === "low" ? "Learn more" : "Get started";
  const modifiers = input.toneModifiers.length > 0 ? ` ${input.toneModifiers.slice(0, 2).join(" + ")}.` : "";
  const styleTail = input.styleFlags.length > 0 ? ` Built to stay ${input.styleFlags.slice(0, 2).join(" and ")}.` : "";
  const avoidTail = input.avoidFlags.length > 0 ? ` Avoiding ${input.avoidFlags[0].replaceAll("_", " ")}.` : "";

  return {
    headline: `${opener} ${seed} ${confidenceWord}`.replaceAll(/\s+/g, " ").trim(),
    cta: `${action} ${confidence === "high" ? "today" : "this week"}`.trim(),
    email_intro: `${warmthWord[0]?.toUpperCase() ?? ""}${warmthWord.slice(
      1
    )} tone, ${input.primaryTone} delivery.${modifiers} ${cadence}`.replaceAll(/\s+/g, " "),
    description: `${input.name || "Your brand voice"} helps teams communicate around ${seed} in a ${warmthWord}, ${
      directness === "high" ? "direct" : "balanced"
    } way.${styleTail}${avoidTail}`.replaceAll(/\s+/g, " ")
  };
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

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
export const traitStatuses = ["DRAFT", "IN_REVIEW", "ACTIVE", "DEPRECATED"] as const;
export const programStatuses = ["DRAFT", "ACTIVE", "INACTIVE"] as const;
export const quizExperiencePresets = [
  "ADMISSIONS_MARKETING",
  "EXECUTIVE_MBA",
  "GEN_Z_SOCIAL",
  "TRADITIONAL_ACADEMIC",
  "EXPERIMENTAL_AI"
] as const;

export type TraitCategory = (typeof traitCategories)[number];
export type ProgramTraitPriorityBucket = (typeof programTraitPriorityBuckets)[number];
export type TraitQuestionType = (typeof traitQuestionTypes)[number];
export type TraitStatus = (typeof traitStatuses)[number];
export type ProgramStatus = (typeof programStatuses)[number];
export type BrandVoiceTone = (typeof brandVoiceTones)[number];
export type BrandVoiceSampleType = (typeof brandVoiceSampleTypes)[number];
export type QuizExperiencePreset = (typeof quizExperiencePresets)[number];
export type QuizMotionIntensity = "LOW" | "MEDIUM" | "HIGH";

export type QuizExperienceResolvedFields = {
  gradientSet: string;
  motionIntensity: QuizMotionIntensity;
  rankingMotionStyle: string;
  revealStyle: string;
  tonePreset: string;
};

export type QuizExperienceOverrides = Partial<QuizExperienceResolvedFields>;

export const QUIZ_EXPERIENCE_PRESETS: Record<QuizExperiencePreset, QuizExperienceResolvedFields> = {
  ADMISSIONS_MARKETING: {
    gradientSet: "SUNRISE",
    motionIntensity: "MEDIUM",
    rankingMotionStyle: "SPRING",
    revealStyle: "IDENTITY",
    tonePreset: "GEN_Z_FRIENDLY"
  },
  EXECUTIVE_MBA: {
    gradientSet: "SUNRISE",
    motionIntensity: "LOW",
    rankingMotionStyle: "SPRING",
    revealStyle: "RANKED_LIST",
    tonePreset: "PROFESSIONAL"
  },
  GEN_Z_SOCIAL: {
    gradientSet: "SUNRISE",
    motionIntensity: "HIGH",
    rankingMotionStyle: "SPRING",
    revealStyle: "IDENTITY",
    tonePreset: "GEN_Z_FRIENDLY"
  },
  TRADITIONAL_ACADEMIC: {
    gradientSet: "SUNRISE",
    motionIntensity: "LOW",
    rankingMotionStyle: "SPRING",
    revealStyle: "RANKED_LIST",
    tonePreset: "NEUTRAL"
  },
  EXPERIMENTAL_AI: {
    gradientSet: "SUNRISE",
    motionIntensity: "HIGH",
    rankingMotionStyle: "SPRING",
    revealStyle: "IDENTITY",
    tonePreset: "PLAYFUL"
  }
};

export const resolveQuizExperienceConfig = (
  preset: QuizExperiencePreset | null | undefined,
  overrides: QuizExperienceOverrides | null | undefined,
  explicitFields?: Partial<QuizExperienceResolvedFields> | null
): QuizExperienceResolvedFields => {
  const base = preset ? QUIZ_EXPERIENCE_PRESETS[preset] : undefined;

  return {
    gradientSet:
      explicitFields?.gradientSet ??
      overrides?.gradientSet ??
      base?.gradientSet ??
      QUIZ_EXPERIENCE_PRESETS.ADMISSIONS_MARKETING.gradientSet,
    motionIntensity:
      explicitFields?.motionIntensity ??
      overrides?.motionIntensity ??
      base?.motionIntensity ??
      QUIZ_EXPERIENCE_PRESETS.ADMISSIONS_MARKETING.motionIntensity,
    rankingMotionStyle:
      explicitFields?.rankingMotionStyle ??
      overrides?.rankingMotionStyle ??
      base?.rankingMotionStyle ??
      QUIZ_EXPERIENCE_PRESETS.ADMISSIONS_MARKETING.rankingMotionStyle,
    revealStyle:
      explicitFields?.revealStyle ??
      overrides?.revealStyle ??
      base?.revealStyle ??
      QUIZ_EXPERIENCE_PRESETS.ADMISSIONS_MARKETING.revealStyle,
    tonePreset:
      explicitFields?.tonePreset ??
      overrides?.tonePreset ??
      base?.tonePreset ??
      QUIZ_EXPERIENCE_PRESETS.ADMISSIONS_MARKETING.tonePreset
  };
};

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
  status: TraitStatus;
  definition: string | null;
  rubricScaleMin: number;
  rubricScaleMax: number;
  rubricPositiveSignals: string | null;
  rubricNegativeSignals: string | null;
  rubricFollowUps: string | null;
  completeness?: {
    isComplete: boolean;
    percentComplete: number;
    missing: string[];
    counts: {
      positiveSignals: number;
      negativeSignals: number;
      questions: number;
    };
  };
  createdAt: string;
  updatedAt: string;
};

export type TraitQuestion = {
  id: string;
  traitId: string;
  type: TraitQuestionType;
  prompt: string;
  optionsJson: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export type Program = {
  id: string;
  name: string;
  description: string | null;
  degreeLevel: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProgramStatusInput = {
  degreeLevel?: string | null;
  department?: string | null;
  isActive?: boolean | null;
};

const hasNonEmptyText = (value?: string | null) => (value ?? "").trim().length > 0;

export const isProgramDraft = (program: ProgramStatusInput): boolean =>
  !hasNonEmptyText(program.degreeLevel) || !hasNonEmptyText(program.department);

export const computeProgramStatus = (program: ProgramStatusInput): ProgramStatus => {
  if (isProgramDraft(program)) return "DRAFT";
  return program.isActive ? "ACTIVE" : "INACTIVE";
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

export type TraitState = {
  traitId: string;
  traitName: string;
  category?: TraitCategory | null;
  score0to5: number | null;
  confidence0to1: number;
};

export type ProgramTraitWeightInput = {
  traitId: string;
  weight: number;
};

export type ProgramMatchInput = {
  programId: string;
  programName: string;
  traits: ProgramTraitWeightInput[];
};

export type ProgramExplainability = {
  topContributors: Array<{ traitId: string; traitName: string; contribution: number }>;
  gaps: Array<{ traitId: string; traitName: string; reason: "low_score" | "low_confidence" | "missing" }>;
  suggestions: Array<{ traitId: string; traitName: string; reason: string }>;
};

export type RankedProgram = {
  programId: string;
  programName: string;
  fitScore_0_to_100: number;
  confidence_0_to_1: number;
  deltaFromLast_0_to_100: number;
  explainability: ProgramExplainability;
};

export type ProgramRankingOutput = {
  programs: RankedProgram[];
};

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeTraitWeights = (weights: ProgramTraitWeightInput[]) => {
  const clean = weights.filter((item) => Number.isFinite(item.weight) && item.weight > 0);
  const total = clean.reduce((acc, item) => acc + item.weight, 0);
  if (clean.length === 0 || total <= 0) {
    return [] as ProgramTraitWeightInput[];
  }
  return clean.map((item) => ({ ...item, weight: item.weight / total }));
};

const scoreNormFromTrait = (state?: TraitState) => {
  if (!state || state.score0to5 === null) return 0.5;
  return clampNumber(state.score0to5 / 5, 0, 1);
};

const traitStateById = (traits: TraitState[]) => new Map(traits.map((trait) => [trait.traitId, trait]));

export const rankProgramsByTraits = (input: {
  programs: ProgramMatchInput[];
  traits: TraitState[];
  previousScores?: Record<string, number>;
  limit?: number;
}): ProgramRankingOutput => {
  const traitById = traitStateById(input.traits);
  const previousScores = input.previousScores ?? {};
  const scored = input.programs.map((program) => {
    const normalizedWeights = normalizeTraitWeights(program.traits);
    const contributions = normalizedWeights.map((item) => {
      const state = traitById.get(item.traitId);
      const traitName = state?.traitName ?? item.traitId;
      const scoreNorm = scoreNormFromTrait(state);
      return {
        traitId: item.traitId,
        traitName,
        weight: item.weight,
        scoreNorm,
        confidence: clampNumber(state?.confidence0to1 ?? 0, 0, 1),
        missing: !state || state.score0to5 === null,
        contribution: item.weight * scoreNorm
      };
    });

    const raw = contributions.reduce((acc, item) => acc + item.contribution, 0);
    const fitScore = Math.round(raw * 100);

    let confidence = contributions.reduce((acc, item) => acc + item.weight * item.confidence, 0);
    const topContributors = [...contributions]
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((item) => ({
        traitId: item.traitId,
        traitName: item.traitName,
        contribution: Number(item.contribution.toFixed(3))
      }));

    const gaps: ProgramExplainability["gaps"] = [...contributions]
      .filter((item) => item.weight >= 0.16 && (item.missing || item.scoreNorm < 0.55 || item.confidence < 0.55))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((item) => ({
        traitId: item.traitId,
        traitName: item.traitName,
        reason: (item.missing ? "missing" : item.confidence < 0.55 ? "low_confidence" : "low_score") as
          | "missing"
          | "low_confidence"
          | "low_score"
      }));

    const suggestions = gaps.map((item) => ({
      traitId: item.traitId,
      traitName: item.traitName,
      reason: item.reason === "missing" ? "Assess this trait next." : "Gather one more concrete example."
    }));

    const prev = previousScores[program.programId] ?? fitScore;
    return {
      programId: program.programId,
      programName: program.programName,
      fitScore_0_to_100: fitScore,
      confidence_0_to_1: confidence,
      deltaFromLast_0_to_100: Number((fitScore - prev).toFixed(1)),
      explainability: {
        topContributors,
        gaps,
        suggestions
      }
    };
  });

  const ordered = scored.sort((a, b) => b.fitScore_0_to_100 - a.fitScore_0_to_100 || a.programName.localeCompare(b.programName));
  if (ordered.length >= 2) {
    const separation = (ordered[0].fitScore_0_to_100 - ordered[1].fitScore_0_to_100) / 100;
    if (separation < 0.05) {
      ordered.forEach((item) => {
        item.confidence_0_to_1 = clampNumber(item.confidence_0_to_1 * 0.85, 0, 1);
      });
    }
  }

  const limit = Math.max(1, Math.min(10, input.limit ?? 5));
  return {
    programs: ordered.slice(0, limit).map((item) => ({
      ...item,
      confidence_0_to_1: Number(clampNumber(item.confidence_0_to_1, 0, 1).toFixed(2))
    }))
  };
};

export const computeTraitImpacts = (input: {
  programs: ProgramMatchInput[];
  topProgramIds?: string[];
  maxPrograms?: number;
}): Record<string, number> => {
  const selected = input.topProgramIds?.length
    ? input.programs.filter((program) => input.topProgramIds?.includes(program.programId))
    : input.programs.slice(0, Math.max(1, input.maxPrograms ?? 5));

  const byTrait = new Map<string, number[]>();
  selected.forEach((program) => {
    const normalized = normalizeTraitWeights(program.traits);
    normalized.forEach((item) => {
      const values = byTrait.get(item.traitId) ?? [];
      values.push(item.weight);
      byTrait.set(item.traitId, values);
    });
  });

  const output: Record<string, number> = {};
  byTrait.forEach((values, traitId) => {
    if (values.length === 0) {
      output[traitId] = 0.2;
      return;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    output[traitId] = clampNumber((max - min) * 5, 0.1, 1);
  });
  return output;
};

export const pickNextTrait = (input: {
  traits: Array<{ traitId: string; category?: TraitCategory | null }>;
  traitStates: TraitState[];
  traitImpacts: Record<string, number>;
  recentTraitIds?: string[];
  maxSameCategoryInRow?: number;
}): { traitId: string | null; scores: Array<{ traitId: string; priority: number }> } => {
  const states = traitStateById(input.traitStates);
  const recent = input.recentTraitIds ?? [];
  const recentWindow = recent.slice(-6);
  const lastTraitId = recentWindow[recentWindow.length - 1] ?? null;
  const maxSameCategoryInRow = input.maxSameCategoryInRow ?? 2;
  const lastCategory = recent.length > 0 ? input.traits.find((item) => item.traitId === recent[recent.length - 1])?.category : null;
  const recentSameCategoryCount = lastCategory
    ? recent
        .slice(-maxSameCategoryInRow)
        .map((traitId) => input.traits.find((item) => item.traitId === traitId)?.category)
        .filter((category) => category === lastCategory).length
    : 0;

  const scored = input.traits.map((trait) => {
    const current = states.get(trait.traitId);
    const uncertainty = 1 - clampNumber(current?.confidence0to1 ?? 0, 0, 1);
    const impact = clampNumber(input.traitImpacts[trait.traitId] ?? 0.35, 0.1, 1);
    const recentCount = recentWindow.filter((traitId) => traitId === trait.traitId).length;
    let consecutiveCount = 0;
    for (let index = recentWindow.length - 1; index >= 0; index -= 1) {
      if (recentWindow[index] === trait.traitId) {
        consecutiveCount += 1;
        continue;
      }
      break;
    }
    let coverageBoost = 1;
    if (recentCount > 0) {
      coverageBoost *= Math.pow(0.6, recentCount);
    }
    if (lastTraitId === trait.traitId) {
      coverageBoost *= 0.5;
    }
    if (consecutiveCount >= 2) {
      coverageBoost *= 0.35;
    }
    if (lastCategory && trait.category === lastCategory && recentSameCategoryCount >= maxSameCategoryInRow) {
      coverageBoost *= 0.3;
    }
    const priority = uncertainty * impact * clampNumber(coverageBoost, 0.05, 1);
    return { traitId: trait.traitId, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  return {
    traitId: scored[0]?.traitId ?? null,
    scores: scored
  };
};

export const shouldTriggerCheckpoint = (answeredTraitCount: number, interval = 3) =>
  answeredTraitCount > 0 && answeredTraitCount % Math.max(1, interval) === 0;

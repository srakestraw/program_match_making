import { Router, type Request, type Response } from "express";
import {
  ConversationPersona,
  ConversationScenarioStage,
  ConversationTurnRole,
  Prisma,
  QuizExperiencePreset,
  ProgramTraitPriorityBucket,
  TraitAnswerStyle,
  TraitCategory,
  TraitVisualMood,
  TraitQuestionType,
  WidgetThemeSource,
  WidgetThemeStatus
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  brandVoiceDefaults,
  buildBrandVoicePrompt,
  createBrandVoiceSchema,
  generateSamplesSchema,
  normalizeCanonicalExamples,
  normalizeToneProfile,
  updateBrandVoiceSchema
} from "../lib/brandVoice.js";
import { generateBrandVoiceSamples } from "../lib/brandVoiceSamples.js";
import {
  calculateStabilityScore,
  composeAssistantReply,
  findAvoidHits,
  pressureTestPrompts
} from "../lib/simulationLab.js";
import { synthesizeVoiceSample } from "../lib/simulationVoice.js";
import {
  generateTraitQuestions,
  generateTraitSignals,
  generateTraitExperienceDraft
} from "../lib/traitContentGeneration.js";
import { computeTraitCompleteness } from "../domain/traits/completeness.js";
import { resolveQuizExperienceConfig, type QuizExperienceOverrides, quizExperiencePresets } from "@pmm/domain";
import {
  normalizeWidgetThemeTokens,
  scrapeWidgetThemeFromUrl,
  widgetThemeTokensSchema
} from "../lib/widgetTheme.js";

const idParamSchema = z.object({ id: z.string().min(1) });
const questionIdParamSchema = z.object({ questionId: z.string().min(1) });

const traitCategorySchema = z.nativeEnum(TraitCategory);
const traitQuestionTypeSchema = z.enum(["chat", "quiz"]);
const traitAnswerStyleSchema = z.enum(["RADIO", "CARD_GRID", "SLIDER", "CHAT"]);
const traitVisualMoodSchema = z.enum(["NEUTRAL", "ASPIRATIONAL", "PLAYFUL", "BOLD", "SERIOUS"]);
const archetypeTagSchema = z.enum([
  "ANALYST",
  "BUILDER",
  "STRATEGIST",
  "OPERATOR",
  "VISIONARY",
  "LEADER",
  "COMMUNICATOR"
]);
const traitStatusSchema = z.enum(["DRAFT", "IN_REVIEW", "ACTIVE", "DEPRECATED"]);
type TraitStatusValue = z.infer<typeof traitStatusSchema>;
const bucketSchema = z.nativeEnum(ProgramTraitPriorityBucket);
const traitIncludeSchema = z.enum(["programSummary"]);
const conversationStageSchema = z.nativeEnum(ConversationScenarioStage);
const conversationPersonaSchema = z.nativeEnum(ConversationPersona);
const traitProgramParamsSchema = z.object({
  id: z.string().min(1),
  programId: z.string().min(1)
});

const createTraitSchema = z.object({
  name: z.string().trim().max(120).optional(),
  category: traitCategorySchema.optional(),
  status: traitStatusSchema.optional(),
  definition: z.string().trim().max(1000).nullable().optional(),
  publicLabel: z.string().trim().max(120).nullable().optional(),
  oneLineHook: z.string().trim().max(180).nullable().optional(),
  archetypeTag: archetypeTagSchema.nullable().optional(),
  displayIcon: z.string().trim().max(80).nullable().optional(),
  visualMood: traitVisualMoodSchema.nullable().optional(),
  experienceDraftJson: z.string().trim().max(20000).nullable().optional(),
  rubricScaleMin: z.number().int().default(0),
  rubricScaleMax: z.number().int().default(5),
  rubricPositiveSignals: z.string().trim().max(2000).nullable().optional(),
  rubricNegativeSignals: z.string().trim().max(2000).nullable().optional(),
  rubricFollowUps: z.string().trim().max(2000).nullable().optional()
});

const updateTraitSchema = createTraitSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

const createTraitQuestionSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  questionText: z.string().trim().min(1).max(2000).optional(),
  narrativeIntro: z.string().trim().max(400).nullable().optional(),
  answerStyle: traitAnswerStyleSchema.optional(),
  answerOptionsMeta: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        microCopy: z.string().trim().max(240).optional(),
        iconToken: z.string().trim().max(80).optional(),
        traitScore: z.number().min(0).max(5).optional()
      })
    )
    .max(20)
    .optional(),
  type: traitQuestionTypeSchema,
  options: z.array(z.string().trim().min(1).max(300)).max(20).optional()
}).strict();

const updateTraitQuestionSchema = createTraitQuestionSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

const createProgramSchema = z.object({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).nullable().optional(),
  degreeLevel: z.string().trim().max(120).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean().optional()
});

const updateProgramSchema = createProgramSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

const saveProgramTraitsSchema = z.object({
  items: z.array(
    z.object({
      traitId: z.string().min(1),
      bucket: bucketSchema,
      sortOrder: z.number().int().nonnegative(),
      notes: z.string().trim().max(1000).nullable().optional()
    })
  )
});

const traitProgramCreateSchema = z.object({
  programId: z.string().min(1),
  bucket: bucketSchema,
  weight: z.number().min(0).max(1)
});

const traitProgramPatchSchema = z
  .object({
    bucket: bucketSchema.optional(),
    weight: z.number().min(0).max(1).optional()
  })
  .refine((value) => value.bucket !== undefined || value.weight !== undefined, {
    message: "At least one field is required"
  });

const createSimulationSchema = z
  .object({
    scenarioId: z.string().min(1).optional(),
    persona: conversationPersonaSchema,
    customScenario: z.string().trim().min(1).max(4000).optional()
  })
  .refine((value) => Boolean(value.scenarioId || value.customScenario), {
    message: "scenarioId or customScenario is required"
  });

const getQuizExperienceId = () => "default";
const quizExperiencePresetSchema = z.enum(quizExperiencePresets);
const quizExperienceOverridesSchema = z
  .object({
    gradientSet: z.string().trim().min(1).max(80).optional(),
    motionIntensity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    rankingMotionStyle: z.string().trim().min(1).max(80).optional(),
    revealStyle: z.string().trim().min(1).max(80).optional(),
    tonePreset: z.string().trim().min(1).max(80).optional()
  })
  .strict();
const upsertQuizExperienceSchema = z.object({
  headline: z.string().trim().min(1).max(180),
  subheadline: z.string().trim().min(1).max(240),
  estimatedTimeLabel: z.string().trim().min(1).max(40),
  tonePreset: z.string().trim().min(1).max(80),
  gradientSet: z.string().trim().min(1).max(80),
  motionIntensity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  rankingMotionStyle: z.string().trim().min(1).max(80),
  revealStyle: z.string().trim().min(1).max(80),
  experiencePreset: quizExperiencePresetSchema.nullable().optional(),
  experienceOverrides: quizExperienceOverridesSchema.nullable().optional(),
  introMediaPrompt: z.string().trim().max(1200).nullable().optional(),
  revealMediaPrompt: z.string().trim().max(1200).nullable().optional()
});

const traitExperienceDraftSchema = z.object({
  action: z.enum(["generate", "gen_z", "simplify", "aspirational"]).default("generate")
});

const createSimulationTurnSchema = z.object({
  userMessage: z.string().trim().min(1).max(4000).optional()
});

const createVoiceSampleSchema = z.object({
  turnId: z.string().min(1),
  voiceName: z.string().trim().max(120).optional()
});

const testBrandVoiceSchema = z.object({
  voiceName: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(2000)
});

const widgetThemeSourceSchema = z.nativeEnum(WidgetThemeSource);
const widgetThemeStatusSchema = z.nativeEnum(WidgetThemeStatus);
const upsertWidgetThemeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: widgetThemeStatusSchema.optional().default(WidgetThemeStatus.DRAFT),
  source: widgetThemeSourceSchema.default(WidgetThemeSource.MANUAL),
  sourceUrl: z.string().trim().url().optional().nullable(),
  tokens: widgetThemeTokensSchema
});
const scrapeWidgetThemeSchema = z.object({
  url: z.string().trim().url().refine((value) => value.startsWith("https://"), { message: "URL must start with https://" })
});
const activateWidgetThemeSchema = z.object({
  id: z.string().min(1).optional()
});

const toNull = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeQuizExperienceOverrides = (
  raw: unknown
): QuizExperienceOverrides | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const parsed = quizExperienceOverridesSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const entries = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries) as QuizExperienceOverrides;
};

const formatQuizExperienceConfig = (config: {
  id: string;
  headline: string;
  subheadline: string;
  estimatedTimeLabel: string;
  tonePreset: string;
  gradientSet: string;
  motionIntensity: string;
  rankingMotionStyle: string;
  revealStyle: string;
  experiencePreset: QuizExperiencePreset | null;
  experienceOverrides: Prisma.JsonValue | null;
  introMediaPrompt: string | null;
  revealMediaPrompt: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const experienceOverrides = normalizeQuizExperienceOverrides(config.experienceOverrides);
  const resolved = resolveQuizExperienceConfig(
    config.experiencePreset,
    experienceOverrides,
    {
      gradientSet: config.gradientSet,
      motionIntensity: config.motionIntensity as "LOW" | "MEDIUM" | "HIGH",
      rankingMotionStyle: config.rankingMotionStyle,
      revealStyle: config.revealStyle,
      tonePreset: config.tonePreset
    }
  );

  return {
    id: config.id,
    headline: config.headline,
    subheadline: config.subheadline,
    estimatedTimeLabel: config.estimatedTimeLabel,
    tonePreset: resolved.tonePreset,
    gradientSet: resolved.gradientSet,
    motionIntensity: resolved.motionIntensity,
    rankingMotionStyle: resolved.rankingMotionStyle,
    revealStyle: resolved.revealStyle,
    experiencePreset: config.experiencePreset,
    experienceOverrides,
    introMediaPrompt: config.introMediaPrompt,
    revealMediaPrompt: config.revealMediaPrompt,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString()
  };
};

const toQuestionType = (value: "chat" | "quiz") => (value === "chat" ? TraitQuestionType.CHAT : TraitQuestionType.QUIZ);
const fromQuestionType = (value: TraitQuestionType) => (value === TraitQuestionType.CHAT ? "chat" : "quiz");
const toAnswerStyle = (value?: z.infer<typeof traitAnswerStyleSchema>) =>
  value ? (value as TraitAnswerStyle) : undefined;

const formatTrait = (trait: {
  id: string;
  name: string;
  category: TraitCategory;
  status?: TraitStatusValue;
  definition: string | null;
  publicLabel?: string | null;
  oneLineHook?: string | null;
  archetypeTag?: string | null;
  displayIcon?: string | null;
  visualMood?: z.infer<typeof traitVisualMoodSchema> | null;
  experienceDraftJson?: string | null;
  rubricScaleMin: number;
  rubricScaleMax: number;
  rubricPositiveSignals: string | null;
  rubricNegativeSignals: string | null;
  rubricFollowUps: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    questions: number;
  };
}) => ({
  id: trait.id,
  name: trait.name,
  category: trait.category,
  status: trait.status ?? "DRAFT",
  definition: trait.definition,
  publicLabel: trait.publicLabel ?? null,
  oneLineHook: trait.oneLineHook ?? null,
  archetypeTag: trait.archetypeTag ?? null,
  displayIcon: trait.displayIcon ?? null,
  visualMood: trait.visualMood ?? null,
  experienceDraftJson: trait.experienceDraftJson ?? null,
  rubricScaleMin: trait.rubricScaleMin,
  rubricScaleMax: trait.rubricScaleMax,
  rubricPositiveSignals: trait.rubricPositiveSignals,
  rubricNegativeSignals: trait.rubricNegativeSignals,
  rubricFollowUps: trait.rubricFollowUps,
  completeness: computeTraitCompleteness({
    name: trait.name,
    category: trait.category,
    definition: trait.definition,
    rubricPositiveSignals: trait.rubricPositiveSignals,
    rubricNegativeSignals: trait.rubricNegativeSignals,
    questionsCount: trait._count?.questions ?? 0
  }),
  createdAt: trait.createdAt.toISOString(),
  updatedAt: trait.updatedAt.toISOString()
});

const formatQuestion = (question: {
  id: string;
  traitId: string;
  type: TraitQuestionType;
  prompt: string;
  narrativeIntro: string | null;
  answerStyle: TraitAnswerStyle | null;
  answerOptionsMetaJson: string | null;
  optionsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  // Keep legacy and new clients compatible: prompt remains canonical, questionText aliases prompt.
  id: question.id,
  traitId: question.traitId,
  type: fromQuestionType(question.type),
  prompt: question.prompt,
  questionText: question.prompt,
  narrativeIntro: question.narrativeIntro,
  answerStyle: question.answerStyle,
  answerOptionsMeta: (() => {
    if (!question.answerOptionsMetaJson) return [];
    try {
      const parsed = JSON.parse(question.answerOptionsMetaJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })(),
  options: question.optionsJson ? ((JSON.parse(question.optionsJson) as string[]) ?? []) : [],
  createdAt: question.createdAt.toISOString(),
  updatedAt: question.updatedAt.toISOString()
});

const formatProgram = (program: {
  id: string;
  name: string;
  description: string | null;
  degreeLevel: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...program,
  createdAt: program.createdAt.toISOString(),
  updatedAt: program.updatedAt.toISOString()
});

const formatBrandVoice = (voice: {
  id: string;
  name: string;
  primaryTone: string;
  ttsVoiceName: string;
  toneModifiers: string[];
  toneProfile: Prisma.JsonValue;
  styleFlags: string[];
  avoidFlags: string[];
  canonicalExamples: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: voice.id,
  name: voice.name,
  primaryTone: voice.primaryTone,
  ttsVoiceName: voice.ttsVoiceName,
  toneModifiers: Array.isArray(voice.toneModifiers) ? voice.toneModifiers : [],
  toneProfile: normalizeToneProfile(voice.toneProfile),
  styleFlags: Array.isArray(voice.styleFlags) ? voice.styleFlags : [],
  avoidFlags: Array.isArray(voice.avoidFlags) ? voice.avoidFlags : [],
  canonicalExamples: normalizeCanonicalExamples(voice.canonicalExamples),
  createdAt: voice.createdAt.toISOString(),
  updatedAt: voice.updatedAt.toISOString()
});

const formatWidgetTheme = (theme: {
  id: string;
  name: string;
  status: WidgetThemeStatus;
  source: WidgetThemeSource;
  sourceUrl: string | null;
  tokens: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: theme.id,
  name: theme.name,
  status: theme.status,
  source: theme.source,
  sourceUrl: theme.sourceUrl,
  tokens: normalizeWidgetThemeTokens(theme.tokens),
  createdAt: theme.createdAt.toISOString(),
  updatedAt: theme.updatedAt.toISOString()
});

const formatSimulationScenario = (scenario: {
  id: string;
  title: string;
  stage: ConversationScenarioStage;
  persona: ConversationPersona | null;
  seedPrompt: string;
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: scenario.id,
  title: scenario.title,
  stage: scenario.stage,
  persona: scenario.persona,
  seedPrompt: scenario.seedPrompt,
  isPreset: scenario.isPreset,
  createdAt: scenario.createdAt.toISOString(),
  updatedAt: scenario.updatedAt.toISOString()
});

const formatSimulation = (simulation: {
  id: string;
  brandVoiceId: string;
  scenarioId: string | null;
  persona: ConversationPersona;
  customScenario: string | null;
  stabilityScore: number | null;
  createdAt: Date;
}) => ({
  id: simulation.id,
  brandVoiceId: simulation.brandVoiceId,
  scenarioId: simulation.scenarioId,
  persona: simulation.persona,
  customScenario: simulation.customScenario,
  stabilityScore: simulation.stabilityScore,
  createdAt: simulation.createdAt.toISOString()
});

const formatTurn = (turn: {
  id: string;
  simulationId: string;
  role: ConversationTurnRole;
  content: string;
  createdAt: Date;
  order: number;
}) => ({
  id: turn.id,
  simulationId: turn.simulationId,
  role: turn.role,
  content: turn.content,
  createdAt: turn.createdAt.toISOString(),
  order: turn.order
});

const summarizeAvoidHits = (hits: Array<{ token: string }>) => {
  const counts = new Map<string, number>();
  for (const hit of hits) {
    counts.set(hit.token, (counts.get(hit.token) ?? 0) + 1);
  }
  return [...counts.entries()].map(([token, count]) => ({ token, count }));
};

const parseError = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target)
  ) {
    return `Unique constraint failed on ${error.meta.target.join(", ")}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Invalid payload";
};

const isMissingWidgetThemeTableError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2021" &&
  typeof error.meta?.table === "string" &&
  String(error.meta.table).includes("WidgetTheme");

const bucketRank: Record<ProgramTraitPriorityBucket, number> = {
  CRITICAL: 0,
  VERY_IMPORTANT: 1,
  IMPORTANT: 2,
  NICE_TO_HAVE: 3
};

const defaultWeightByBucket: Record<ProgramTraitPriorityBucket, number> = {
  CRITICAL: 1,
  VERY_IMPORTANT: 0.75,
  IMPORTANT: 0.5,
  NICE_TO_HAVE: 0.25
};

const pickNextUntitledTraitName = async () => {
  const baseName = "Untitled trait";
  const existing = await prisma.trait.findMany({
    where: {
      name: {
        startsWith: baseName
      }
    },
    select: {
      name: true
    }
  });

  const used = new Set<number>();
  for (const row of existing) {
    if (row.name === baseName) {
      used.add(1);
      continue;
    }
    const match = row.name.match(/^Untitled trait (\d+)$/);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > 1) {
      used.add(parsed);
    }
  }

  if (!used.has(1)) {
    return baseName;
  }

  let suffix = 2;
  while (used.has(suffix)) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
};

const parseProgramTraitNotes = (raw: string | null | undefined): { weight?: number } => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { weight?: unknown };
    const weight = Number(parsed?.weight);
    if (!Number.isFinite(weight)) return {};
    return { weight: Math.max(0, Math.min(1, weight)) };
  } catch {
    return {};
  }
};

const weightFromProgramTrait = (item: { notes: string | null; bucket: ProgramTraitPriorityBucket }): number => {
  const parsed = parseProgramTraitNotes(item.notes).weight;
  if (parsed === undefined) {
    return defaultWeightByBucket[item.bucket];
  }
  return parsed;
};

const notesWithWeight = (weight: number): string => JSON.stringify({ weight: Math.max(0, Math.min(1, weight)) });

export const adminRouter = Router();

adminRouter.get("/traits", async (req, res) => {
  try {
    const query = z
      .object({
        q: z.string().trim().optional(),
        category: traitCategorySchema.optional(),
        include: z.union([traitIncludeSchema, z.array(traitIncludeSchema)]).optional()
      })
      .parse(req.query);
    const includeValues = Array.isArray(query.include) ? query.include : query.include ? [query.include] : [];
    const includeProgramSummary = includeValues.includes("programSummary");

    const traits = await prisma.trait.findMany({
      where: {
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { definition: { contains: query.q, mode: "insensitive" } }
              ]
            }
          : {}),
        ...(query.category ? { category: query.category } : {})
      },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      },
      orderBy: { name: "asc" }
    });

    const formattedTraits = traits.map(formatTrait);

    if (!includeProgramSummary || traits.length === 0) {
      res.json({ data: formattedTraits });
      return;
    }

    const traitIds = traits.map((trait) => trait.id);
    const programTraitCounts = await prisma.programTrait.groupBy({
      by: ["traitId"],
      where: { traitId: { in: traitIds } },
      _count: { traitId: true }
    });
    const countsByTraitId = new Map<string, number>(programTraitCounts.map((item) => [item.traitId, item._count.traitId]));

    const allProgramTraitLinks = await prisma.programTrait.findMany({
      where: { traitId: { in: traitIds } },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            updatedAt: true
          }
        }
      }
    });

    const topProgramsByTraitId = new Map<
      string,
      Array<{ programId: string; programName: string; bucket: ProgramTraitPriorityBucket; weight: number }>
    >();
    for (const traitId of traitIds) {
      const topThree = allProgramTraitLinks
        .filter((item) => item.traitId === traitId)
        .sort((a, b) => {
          const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
          if (bucketDiff !== 0) return bucketDiff;
          const weightDiff = weightFromProgramTrait(b) - weightFromProgramTrait(a);
          if (weightDiff !== 0) return weightDiff;
          return b.program.updatedAt.getTime() - a.program.updatedAt.getTime();
        })
        .slice(0, 3)
        .map((item) => ({
          programId: item.programId,
          programName: item.program.name,
          bucket: item.bucket,
          weight: Number(weightFromProgramTrait(item).toFixed(2))
        }));
      topProgramsByTraitId.set(traitId, topThree);
    }

    res.json({
      data: formattedTraits.map((trait) => ({
        ...trait,
        programSummary: {
          count: countsByTraitId.get(trait.id) ?? 0,
          topPrograms: topProgramsByTraitId.get(trait.id) ?? []
        }
      }))
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/traits", async (req, res) => {
  try {
    const body = createTraitSchema.parse(req.body);
    const requestedName = body.name?.trim();
    const resolvedName = requestedName && requestedName.length > 0 ? requestedName : await pickNextUntitledTraitName();
    const resolvedCategory = body.category ?? TraitCategory.ACADEMIC;
    const resolvedStatus = body.status ?? "DRAFT";
    const createCompleteness = computeTraitCompleteness({
      name: resolvedName,
      category: resolvedCategory,
      definition: toNull(body.definition),
      rubricPositiveSignals: toNull(body.rubricPositiveSignals),
      rubricNegativeSignals: toNull(body.rubricNegativeSignals),
      questionsCount: 0
    });
    if (resolvedStatus === "ACTIVE" && !createCompleteness.isComplete) {
      res.status(400).json({
        error: {
          code: "TRAIT_INCOMPLETE",
          message: "Trait incomplete",
          missing: createCompleteness.missing,
          details: createCompleteness
        }
      });
      return;
    }

    const trait = await prisma.trait.create({
      data: {
        name: resolvedName,
        category: resolvedCategory,
        status: resolvedStatus,
        definition: toNull(body.definition),
        publicLabel: toNull(body.publicLabel),
        oneLineHook: toNull(body.oneLineHook),
        archetypeTag: toNull(body.archetypeTag),
        displayIcon: toNull(body.displayIcon),
        visualMood: body.visualMood ?? null,
        experienceDraftJson: toNull(body.experienceDraftJson),
        rubricScaleMin: body.rubricScaleMin,
        rubricScaleMax: body.rubricScaleMax,
        rubricPositiveSignals: toNull(body.rubricPositiveSignals),
        rubricNegativeSignals: toNull(body.rubricNegativeSignals),
        rubricFollowUps: toNull(body.rubricFollowUps)
      },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      }
    });

    res.status(201).json({ data: formatTrait(trait) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/traits/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const trait = await prisma.trait.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      }
    });

    if (!trait) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }

    res.json({ data: formatTrait(trait) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.put("/traits/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateTraitSchema.parse(req.body);
    const existing = await prisma.trait.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      }
    });

    if (!existing) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }

    const nextStatus = body.status ?? ((existing as { status?: TraitStatusValue }).status ?? "DRAFT");
    const completionCheck = computeTraitCompleteness({
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      definition: body.definition !== undefined ? toNull(body.definition) : existing.definition,
      rubricPositiveSignals:
        body.rubricPositiveSignals !== undefined
          ? toNull(body.rubricPositiveSignals)
          : existing.rubricPositiveSignals,
      rubricNegativeSignals:
        body.rubricNegativeSignals !== undefined
          ? toNull(body.rubricNegativeSignals)
          : existing.rubricNegativeSignals,
      questionsCount: existing._count.questions
    });

    if (nextStatus === "ACTIVE" && !completionCheck.isComplete) {
      res.status(400).json({
        error: {
          code: "TRAIT_INCOMPLETE",
          message: "Trait incomplete",
          missing: completionCheck.missing,
          details: completionCheck
        }
      });
      return;
    }

    const trait = await prisma.trait.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.definition !== undefined ? { definition: toNull(body.definition) } : {}),
        ...(body.publicLabel !== undefined ? { publicLabel: toNull(body.publicLabel) } : {}),
        ...(body.oneLineHook !== undefined ? { oneLineHook: toNull(body.oneLineHook) } : {}),
        ...(body.archetypeTag !== undefined ? { archetypeTag: toNull(body.archetypeTag) } : {}),
        ...(body.displayIcon !== undefined ? { displayIcon: toNull(body.displayIcon) } : {}),
        ...(body.visualMood !== undefined ? { visualMood: body.visualMood } : {}),
        ...(body.experienceDraftJson !== undefined ? { experienceDraftJson: toNull(body.experienceDraftJson) } : {}),
        ...(body.rubricScaleMin !== undefined ? { rubricScaleMin: body.rubricScaleMin } : {}),
        ...(body.rubricScaleMax !== undefined ? { rubricScaleMax: body.rubricScaleMax } : {}),
        ...(body.rubricPositiveSignals !== undefined
          ? { rubricPositiveSignals: toNull(body.rubricPositiveSignals) }
          : {}),
        ...(body.rubricNegativeSignals !== undefined
          ? { rubricNegativeSignals: toNull(body.rubricNegativeSignals) }
          : {}),
        ...(body.rubricFollowUps !== undefined ? { rubricFollowUps: toNull(body.rubricFollowUps) } : {})
      },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      }
    });

    res.json({ data: formatTrait(trait) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.delete("/traits/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await prisma.trait.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/traits/:id/programs", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const trait = await prisma.trait.findUnique({ where: { id } });
    if (!trait) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }

    const items = await prisma.programTrait.findMany({
      where: { traitId: id },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            updatedAt: true
          }
        }
      }
    });

    const ordered = [...items].sort((a, b) => {
      const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      const weightDiff = weightFromProgramTrait(b) - weightFromProgramTrait(a);
      if (weightDiff !== 0) return weightDiff;
      return b.program.updatedAt.getTime() - a.program.updatedAt.getTime();
    });

    res.json({
      data: ordered.map((item) => ({
        programId: item.programId,
        programName: item.program.name,
        bucket: item.bucket,
        weight: Number(weightFromProgramTrait(item).toFixed(2)),
        updatedAt: item.program.updatedAt.toISOString()
      }))
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/traits/:id/programs", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = traitProgramCreateSchema.parse(req.body);

    const [trait, program] = await Promise.all([
      prisma.trait.findUnique({ where: { id } }),
      prisma.program.findUnique({ where: { id: body.programId } })
    ]);
    if (!trait) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }
    if (!program) {
      res.status(404).json({ error: "Program not found" });
      return;
    }

    const currentCount = await prisma.programTrait.count({ where: { traitId: id, bucket: body.bucket } });
    const created = await prisma.programTrait.create({
      data: {
        traitId: id,
        programId: body.programId,
        bucket: body.bucket,
        sortOrder: currentCount,
        notes: notesWithWeight(body.weight)
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            updatedAt: true
          }
        }
      }
    });

    res.status(201).json({
      data: {
        programId: created.programId,
        programName: created.program.name,
        bucket: created.bucket,
        weight: Number(weightFromProgramTrait(created).toFixed(2)),
        updatedAt: created.program.updatedAt.toISOString()
      }
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.patch("/traits/:id/programs/:programId", async (req, res) => {
  try {
    const { id, programId } = traitProgramParamsSchema.parse(req.params);
    const body = traitProgramPatchSchema.parse(req.body);
    const existing = await prisma.programTrait.findUnique({
      where: { programId_traitId: { programId, traitId: id } },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            updatedAt: true
          }
        }
      }
    });
    if (!existing) {
      res.status(404).json({ error: "Program association not found" });
      return;
    }

    const currentWeight = weightFromProgramTrait(existing);
    const updated = await prisma.programTrait.update({
      where: { programId_traitId: { programId, traitId: id } },
      data: {
        ...(body.bucket ? { bucket: body.bucket } : {}),
        ...(body.weight !== undefined ? { notes: notesWithWeight(body.weight) } : { notes: notesWithWeight(currentWeight) })
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            updatedAt: true
          }
        }
      }
    });

    res.json({
      data: {
        programId: updated.programId,
        programName: updated.program.name,
        bucket: updated.bucket,
        weight: Number(weightFromProgramTrait(updated).toFixed(2)),
        updatedAt: updated.program.updatedAt.toISOString()
      }
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.delete("/traits/:id/programs/:programId", async (req, res) => {
  try {
    const { id, programId } = traitProgramParamsSchema.parse(req.params);
    await prisma.programTrait.delete({
      where: { programId_traitId: { programId, traitId: id } }
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/traits/:id/generate-signals", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const trait = await prisma.trait.findUnique({ where: { id } });
    if (!trait) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }
    const data = await generateTraitSignals({
      name: trait.name,
      definition: trait.definition,
      category: trait.category
    });
    res.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("OPENAI_API_KEY")) {
      res.status(503).json({ error: "AI generation is not configured (OPENAI_API_KEY missing)." });
      return;
    }
    if (message.startsWith("OPENAI_UPSTREAM")) {
      res.status(502).json({ error: message });
      return;
    }
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/traits/:id/generate-questions", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const trait = await prisma.trait.findUnique({ where: { id } });
    if (!trait) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }
    const data = await generateTraitQuestions({
      name: trait.name,
      definition: trait.definition,
      category: trait.category
    });
    res.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("OPENAI_API_KEY")) {
      res.status(503).json({ error: "AI generation is not configured (OPENAI_API_KEY missing)." });
      return;
    }
    if (message.startsWith("OPENAI_UPSTREAM")) {
      res.status(502).json({ error: message });
      return;
    }
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/traits/:id/experience-draft", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = traitExperienceDraftSchema.parse(req.body ?? {});
    const trait = await prisma.trait.findUnique({ where: { id } });
    if (!trait) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }
    const data = await generateTraitExperienceDraft({
      action: body.action,
      name: trait.name,
      category: trait.category,
      definition: trait.definition
    });
    res.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("OPENAI_API_KEY")) {
      res.status(503).json({ error: "AI generation is not configured (OPENAI_API_KEY missing)." });
      return;
    }
    if (message.startsWith("OPENAI_UPSTREAM")) {
      res.status(502).json({ error: message });
      return;
    }
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/quiz-experience", async (_req, res) => {
  try {
    const id = getQuizExperienceId();
    const config =
      (await prisma.quizExperienceConfig.findUnique({ where: { id } })) ??
      (await prisma.quizExperienceConfig.create({ data: { id, experiencePreset: quizExperiencePresets[0] } }));
    res.json({ data: formatQuizExperienceConfig(config) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.put("/quiz-experience", async (req, res) => {
  try {
    const body = upsertQuizExperienceSchema.parse(req.body);
    const id = getQuizExperienceId();
    const overrides = normalizeQuizExperienceOverrides(body.experienceOverrides ?? null);
    const config = await prisma.quizExperienceConfig.upsert({
      where: { id },
      create: {
        id,
        ...body,
        experiencePreset: body.experiencePreset ?? null,
        experienceOverrides: overrides,
        introMediaPrompt: toNull(body.introMediaPrompt),
        revealMediaPrompt: toNull(body.revealMediaPrompt)
      },
      update: {
        ...body,
        experiencePreset: body.experiencePreset ?? null,
        experienceOverrides: overrides,
        introMediaPrompt: toNull(body.introMediaPrompt),
        revealMediaPrompt: toNull(body.revealMediaPrompt)
      }
    });
    res.json({ data: formatQuizExperienceConfig(config) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/traits/:id/questions", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const trait = await prisma.trait.findUnique({ where: { id } });

    if (!trait) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }

    const questions = await prisma.traitQuestion.findMany({
      where: { traitId: id },
      orderBy: { createdAt: "asc" }
    });
    res.json({ data: questions.map(formatQuestion) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/traits/:id/questions", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = createTraitQuestionSchema.parse(req.body);

    const trait = await prisma.trait.findUnique({ where: { id } });
    if (!trait) {
      res.status(404).json({ error: "Trait not found" });
      return;
    }

    const question = await prisma.traitQuestion.create({
      data: {
        traitId: id,
        prompt: body.questionText ?? body.prompt,
        narrativeIntro: toNull(body.narrativeIntro),
        answerStyle: toAnswerStyle(body.answerStyle) ?? null,
        answerOptionsMetaJson: body.answerOptionsMeta ? JSON.stringify(body.answerOptionsMeta) : null,
        type: toQuestionType(body.type),
        optionsJson: body.type === "quiz" ? JSON.stringify(body.options ?? []) : null
      }
    });

    res.status(201).json({ data: formatQuestion(question) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.put("/questions/:questionId", async (req, res) => {
  try {
    const { questionId } = questionIdParamSchema.parse(req.params);
    const body = updateTraitQuestionSchema.parse(req.body);

    const question = await prisma.traitQuestion.update({
      where: { id: questionId },
      data: {
        ...(body.prompt !== undefined || body.questionText !== undefined
          ? { prompt: body.questionText ?? body.prompt ?? "" }
          : {}),
        ...(body.narrativeIntro !== undefined ? { narrativeIntro: toNull(body.narrativeIntro) } : {}),
        ...(body.answerStyle !== undefined ? { answerStyle: toAnswerStyle(body.answerStyle) ?? null } : {}),
        ...(body.answerOptionsMeta !== undefined
          ? { answerOptionsMetaJson: JSON.stringify(body.answerOptionsMeta) }
          : {}),
        ...(body.type !== undefined ? { type: toQuestionType(body.type) } : {}),
        ...(body.options !== undefined ? { optionsJson: JSON.stringify(body.options) } : {})
      }
    });

    res.json({ data: formatQuestion(question) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.delete("/questions/:questionId", async (req, res) => {
  try {
    const { questionId } = questionIdParamSchema.parse(req.params);
    await prisma.traitQuestion.delete({ where: { id: questionId } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/programs", async (_req, res) => {
  try {
    const programs = await prisma.program.findMany({ orderBy: { name: "asc" } });
    res.json({ data: programs.map(formatProgram) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/programs", async (req, res) => {
  try {
    const body = createProgramSchema.parse(req.body);
    const program = await prisma.program.create({
      data: {
        name: body.name,
        description: toNull(body.description),
        degreeLevel: toNull(body.degreeLevel),
        department: toNull(body.department),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });

    res.status(201).json({ data: formatProgram(program) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/programs/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const program = await prisma.program.findUnique({ where: { id } });

    if (!program) {
      res.status(404).json({ error: "Program not found" });
      return;
    }

    res.json({ data: formatProgram(program) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

const updateProgram = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateProgramSchema.parse(req.body);
    const program = await prisma.program.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: toNull(body.description) } : {}),
        ...(body.degreeLevel !== undefined ? { degreeLevel: toNull(body.degreeLevel) } : {}),
        ...(body.department !== undefined ? { department: toNull(body.department) } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });

    res.json({ data: formatProgram(program) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
};

adminRouter.patch("/programs/:id", updateProgram);

adminRouter.put("/programs/:id", updateProgram);

adminRouter.patch("/programs/:id/status", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = z.object({ isActive: z.boolean() }).parse(req.body);
    const program = await prisma.program.update({
      where: { id },
      data: {
        isActive: body.isActive
      }
    });

    res.json({ data: formatProgram(program) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.delete("/programs/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await prisma.program.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/programs/:id/traits", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const program = await prisma.program.findUnique({ where: { id } });

    if (!program) {
      res.status(404).json({ error: "Program not found" });
      return;
    }

    const items = await prisma.programTrait.findMany({
      where: { programId: id },
      include: {
        trait: {
          include: {
            _count: {
              select: {
                questions: true
              }
            }
          }
        }
      },
      orderBy: [{ bucket: "asc" }, { sortOrder: "asc" }]
    });

    res.json({
      data: items.map((item) => ({
        id: item.id,
        programId: item.programId,
        traitId: item.traitId,
        bucket: item.bucket,
        sortOrder: item.sortOrder,
        notes: item.notes,
        trait: formatTrait(item.trait)
      }))
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.put("/programs/:id/traits", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = saveProgramTraitsSchema.parse(req.body);

    const program = await prisma.program.findUnique({ where: { id } });
    if (!program) {
      res.status(404).json({ error: "Program not found" });
      return;
    }

    const traitIds = [...new Set(body.items.map((item) => item.traitId))];
    const traitCount = await prisma.trait.count({ where: { id: { in: traitIds } } });
    if (traitCount !== traitIds.length) {
      res.status(400).json({ error: "One or more traitIds do not exist" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.programTrait.deleteMany({ where: { programId: id } });

      if (body.items.length > 0) {
        await tx.programTrait.createMany({
          data: body.items.map((item) => ({
            programId: id,
            traitId: item.traitId,
            bucket: item.bucket,
            sortOrder: item.sortOrder,
            notes: toNull(item.notes)
          }))
        });
      }
    });

    const saved = await prisma.programTrait.findMany({
      where: { programId: id },
      orderBy: [{ bucket: "asc" }, { sortOrder: "asc" }]
    });

    res.json({ data: saved });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/brand-voices", async (_req, res) => {
  try {
    const voices = await prisma.brandVoice.findMany({ orderBy: { name: "asc" } });
    res.json({ data: voices.map(formatBrandVoice) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/brand-voices", async (req, res) => {
  try {
    const body = createBrandVoiceSchema.parse(req.body);

    const primaryTone = body.primaryTone ?? brandVoiceDefaults.primaryTone;
    const ttsVoiceName = body.ttsVoiceName ?? brandVoiceDefaults.ttsVoiceName;
    const toneModifiers =
      body.toneModifiers && body.toneModifiers.length > 0 ? body.toneModifiers : [...brandVoiceDefaults.toneModifiers];
    const toneProfile = body.toneProfile ?? { ...brandVoiceDefaults.toneProfile };
    const styleFlags =
      body.styleFlags && body.styleFlags.length > 0
        ? body.styleFlags
        : [...brandVoiceDefaults.styleFlags];
    const avoidFlags =
      body.avoidFlags && body.avoidFlags.length > 0
        ? body.avoidFlags
        : [...brandVoiceDefaults.avoidFlags];
    const canonicalExamples = body.canonicalExamples ?? [];

    const voice = await prisma.brandVoice.create({
      data: {
        name: body.name,
        primaryTone,
        ttsVoiceName,
        toneModifiers,
        toneProfile,
        styleFlags,
        avoidFlags,
        canonicalExamples
      }
    });

    res.status(201).json({ data: formatBrandVoice(voice) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.put("/brand-voices/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateBrandVoiceSchema.parse(req.body);
    const existing = await prisma.brandVoice.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Brand voice not found" });
      return;
    }

    const existingStyleFlags = Array.isArray(existing.styleFlags) ? existing.styleFlags : [];
    const existingAvoidFlags = Array.isArray(existing.avoidFlags) ? existing.avoidFlags : [];
    const existingCanonicalExamples = normalizeCanonicalExamples(existing.canonicalExamples);

    const voice = await prisma.brandVoice.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.primaryTone !== undefined ? { primaryTone: body.primaryTone } : {}),
        ...(body.ttsVoiceName !== undefined ? { ttsVoiceName: body.ttsVoiceName } : {}),
        ...(body.toneModifiers !== undefined ? { toneModifiers: body.toneModifiers } : {}),
        ...(body.toneProfile !== undefined ? { toneProfile: body.toneProfile ?? { ...brandVoiceDefaults.toneProfile } } : {}),
        ...(body.styleFlags !== undefined
          ? { styleFlags: body.styleFlags.length > 0 ? body.styleFlags : existingStyleFlags.length > 0 ? existingStyleFlags : [...brandVoiceDefaults.styleFlags] }
          : {}),
        ...(body.avoidFlags !== undefined
          ? { avoidFlags: body.avoidFlags.length > 0 ? body.avoidFlags : existingAvoidFlags.length > 0 ? existingAvoidFlags : [...brandVoiceDefaults.avoidFlags] }
          : {}),
        ...(body.canonicalExamples !== undefined
          ? {
              canonicalExamples:
                body.canonicalExamples.length > 0
                  ? body.canonicalExamples
                  : existingCanonicalExamples.length > 0
                  ? existingCanonicalExamples
                  : []
            }
          : {})
      }
    });

    res.json({ data: formatBrandVoice(voice) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/brand-voices/:id/generate-samples", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = generateSamplesSchema.parse(req.body ?? {});
    const voice = await prisma.brandVoice.findUnique({ where: { id } });

    if (!voice) {
      res.status(404).json({ error: "Brand voice not found" });
      return;
    }

    const prompt = buildBrandVoicePrompt({
      name: voice.name,
      primaryTone: voice.primaryTone,
      toneModifiers: Array.isArray(voice.toneModifiers) ? voice.toneModifiers : [],
      toneProfile: normalizeToneProfile(voice.toneProfile),
      styleFlags: Array.isArray(voice.styleFlags) ? voice.styleFlags : [],
      avoidFlags: Array.isArray(voice.avoidFlags) ? voice.avoidFlags : [],
      canonicalExamples: normalizeCanonicalExamples(voice.canonicalExamples),
      context: body.context
    });

    const samples = await generateBrandVoiceSamples(prompt);
    res.json({ samples });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/brand-voices/test-voice", async (req, res) => {
  try {
    const body = testBrandVoiceSchema.parse(req.body ?? {});
    const voiceResult = await synthesizeVoiceSample({
      text: body.text,
      voiceName: body.voiceName
    });

    res.status(201).json({
      data: {
        provider: voiceResult.provider,
        voiceName: body.voiceName,
        audioUrl: voiceResult.audioUrl
      }
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/simulation-scenarios", async (req, res) => {
  try {
    const query = z
      .object({
        stage: conversationStageSchema.optional()
      })
      .parse(req.query);

    const scenarios = await prisma.conversationScenario.findMany({
      where: {
        ...(query.stage ? { stage: query.stage } : {})
      },
      orderBy: [{ stage: "asc" }, { title: "asc" }]
    });

    res.json({ data: scenarios.map(formatSimulationScenario) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/brand-voices/:id/simulations", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = createSimulationSchema.parse(req.body ?? {});
    const brandVoice = await prisma.brandVoice.findUnique({ where: { id } });

    if (!brandVoice) {
      res.status(404).json({ error: "Brand voice not found" });
      return;
    }

    let scenario: {
      id: string;
      seedPrompt: string;
    } | null = null;
    if (body.scenarioId) {
      scenario = await prisma.conversationScenario.findUnique({
        where: { id: body.scenarioId },
        select: { id: true, seedPrompt: true }
      });
      if (!scenario) {
        res.status(404).json({ error: "Scenario not found" });
        return;
      }
    }

    const initialUserContent = body.customScenario ?? scenario?.seedPrompt ?? "";

    const created = await prisma.$transaction(async (tx) => {
      const simulation = await tx.conversationSimulation.create({
        data: {
          brandVoiceId: id,
          scenarioId: scenario?.id ?? null,
          persona: body.persona,
          customScenario: body.customScenario ?? null
        }
      });

      const firstTurn = await tx.conversationTurn.create({
        data: {
          simulationId: simulation.id,
          role: ConversationTurnRole.USER,
          content: initialUserContent,
          order: 0
        }
      });

      return { simulation, firstTurn };
    });

    res.status(201).json({
      simulation: formatSimulation(created.simulation),
      turns: [formatTurn(created.firstTurn)]
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/simulations/:id/turns", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = createSimulationTurnSchema.parse(req.body ?? {});

    const simulation = await prisma.conversationSimulation.findUnique({
      where: { id },
      include: {
        scenario: true,
        brandVoice: true,
        turns: {
          orderBy: { order: "asc" }
        }
      }
    });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    let nextOrder = simulation.turns.length;
    let latestUserMessage = body.userMessage?.trim();
    if (!latestUserMessage) {
      latestUserMessage = simulation.customScenario ?? simulation.scenario?.seedPrompt ?? "Please continue.";
    }

    let userTurn:
      | {
          id: string;
          simulationId: string;
          role: ConversationTurnRole;
          content: string;
          createdAt: Date;
          order: number;
        }
      | undefined;

    if (body.userMessage?.trim()) {
      userTurn = await prisma.conversationTurn.create({
        data: {
          simulationId: simulation.id,
          role: ConversationTurnRole.USER,
          content: latestUserMessage,
          order: nextOrder
        }
      });
      nextOrder += 1;
    }

    const assistantText = composeAssistantReply({
      brandVoice: simulation.brandVoice,
      persona: simulation.persona,
      scenarioTitle: simulation.scenario?.title,
      scenarioContext: simulation.customScenario ?? simulation.scenario?.seedPrompt ?? undefined,
      latestUserMessage
    });
    const avoidHits = findAvoidHits(assistantText, simulation.brandVoice.avoidFlags ?? []);
    const stabilityScore = calculateStabilityScore(assistantText, avoidHits.length);

    const assistantTurn = await prisma.conversationTurn.create({
      data: {
        simulationId: simulation.id,
        role: ConversationTurnRole.ASSISTANT,
        content: assistantText,
        order: nextOrder
      }
    });

    await prisma.conversationSimulation.update({
      where: { id: simulation.id },
      data: { stabilityScore }
    });

    res.json({
      ...(userTurn ? { userTurn: formatTurn(userTurn) } : {}),
      assistantTurn: formatTurn(assistantTurn),
      stabilityScore,
      avoidHits: [...new Set(avoidHits.map((hit) => hit.token))],
      highlightedRanges: avoidHits.map((hit) => ({ start: hit.index, end: hit.index + hit.length }))
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/simulations/:id/voice-samples", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = createVoiceSampleSchema.parse(req.body ?? {});
    const turn = await prisma.conversationTurn.findUnique({
      where: { id: body.turnId }
    });

    if (!turn || turn.simulationId !== id || turn.role !== ConversationTurnRole.ASSISTANT) {
      res.status(400).json({ error: "turnId must reference an assistant turn in this simulation" });
      return;
    }

    const simulation = await prisma.conversationSimulation.findUnique({
      where: { id },
      include: {
        brandVoice: {
          select: {
            ttsVoiceName: true
          }
        }
      }
    });
    const resolvedVoiceName = body.voiceName ?? simulation?.brandVoice.ttsVoiceName ?? brandVoiceDefaults.ttsVoiceName;

    const voiceResult = await synthesizeVoiceSample({
      text: turn.content,
      voiceName: resolvedVoiceName
    });

    const created = await prisma.voiceSample.create({
      data: {
        simulationId: id,
        turnId: body.turnId,
        voiceName: resolvedVoiceName,
        provider: voiceResult.provider,
        audioUrl: voiceResult.audioUrl
      }
    });

    res.status(201).json({
      data: {
        id: created.id,
        simulationId: created.simulationId,
        turnId: created.turnId,
        provider: created.provider,
        voiceName: created.voiceName,
        audioUrl: created.audioUrl,
        createdAt: created.createdAt.toISOString()
      }
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/simulations/:id/pressure-test", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const simulation = await prisma.conversationSimulation.findUnique({
      where: { id },
      include: {
        scenario: true,
        brandVoice: true,
        turns: {
          orderBy: { order: "asc" }
        }
      }
    });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    let nextOrder = simulation.turns.length;
    const collectedHits: Array<{ token: string }> = [];
    const scores: number[] = [];

    for (const prompt of pressureTestPrompts) {
      await prisma.conversationTurn.create({
        data: {
          simulationId: simulation.id,
          role: ConversationTurnRole.USER,
          content: prompt,
          order: nextOrder
        }
      });
      nextOrder += 1;

      const assistantText = composeAssistantReply({
        brandVoice: simulation.brandVoice,
        persona: simulation.persona,
        scenarioTitle: simulation.scenario?.title,
        scenarioContext: simulation.customScenario ?? simulation.scenario?.seedPrompt ?? undefined,
        latestUserMessage: prompt
      });
      const avoidHits = findAvoidHits(assistantText, simulation.brandVoice.avoidFlags ?? []);
      const score = calculateStabilityScore(assistantText, avoidHits.length);
      scores.push(score);
      collectedHits.push(...avoidHits.map((hit) => ({ token: hit.token })));

      await prisma.conversationTurn.create({
        data: {
          simulationId: simulation.id,
          role: ConversationTurnRole.ASSISTANT,
          content: assistantText,
          order: nextOrder
        }
      });
      nextOrder += 1;
    }

    const aggregatedScore =
      scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
    if (aggregatedScore !== null) {
      await prisma.conversationSimulation.update({
        where: { id: simulation.id },
        data: { stabilityScore: aggregatedScore }
      });
    }

    const transcript = await prisma.conversationTurn.findMany({
      where: { simulationId: simulation.id },
      orderBy: { order: "asc" }
    });

    res.json({
      transcript: transcript.map(formatTurn),
      aggregatedScore,
      avoidHitsSummary: summarizeAvoidHits(collectedHits)
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.delete("/brand-voices/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await prisma.brandVoice.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.get("/widget-theme", async (_req, res) => {
  try {
    const [active, draft] = await Promise.all([
      prisma.widgetTheme.findFirst({ where: { status: WidgetThemeStatus.ACTIVE }, orderBy: { updatedAt: "desc" } }),
      prisma.widgetTheme.findFirst({ where: { status: WidgetThemeStatus.DRAFT }, orderBy: { updatedAt: "desc" } })
    ]);

    res.json({
      data: {
        active: active ? formatWidgetTheme(active) : null,
        draft: draft ? formatWidgetTheme(draft) : null
      }
    });
  } catch (error) {
    if (isMissingWidgetThemeTableError(error)) {
      res.json({ data: { active: null, draft: null } });
      return;
    }
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/widget-theme", async (req, res) => {
  try {
    const body = upsertWidgetThemeSchema.parse(req.body);
    if (body.status !== WidgetThemeStatus.DRAFT) {
      throw new Error("Widget theme can only be saved as DRAFT via this endpoint");
    }

    const created = await prisma.widgetTheme.create({
      data: {
        name: body.name,
        status: WidgetThemeStatus.DRAFT,
        source: body.source,
        sourceUrl: body.sourceUrl ?? null,
        tokens: normalizeWidgetThemeTokens(body.tokens)
      }
    });

    res.status(201).json({ data: formatWidgetTheme(created) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/widget-theme/scrape", async (req, res) => {
  try {
    const body = scrapeWidgetThemeSchema.parse(req.body);
    const url = new URL(body.url);
    const scraped = await scrapeWidgetThemeFromUrl(body.url);

    const created = await prisma.widgetTheme.create({
      data: {
        name: `Draft from ${url.hostname}`,
        status: WidgetThemeStatus.DRAFT,
        source: WidgetThemeSource.URL_SCRAPE,
        sourceUrl: body.url,
        tokens: scraped.tokens
      }
    });

    res.status(201).json({
      data: formatWidgetTheme(created),
      warnings: scraped.warnings
    });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/widget-theme/activate", async (req, res) => {
  try {
    const body = activateWidgetThemeSchema.parse(req.body ?? {});

    const activated = await prisma.$transaction(async (tx) => {
      const draft = body.id
        ? await tx.widgetTheme.findUnique({ where: { id: body.id } })
        : await tx.widgetTheme.findFirst({
            where: { status: WidgetThemeStatus.DRAFT },
            orderBy: { updatedAt: "desc" }
          });

      if (!draft) {
        throw new Error("Draft theme not found");
      }
      if (draft.status !== WidgetThemeStatus.DRAFT) {
        throw new Error("Only draft themes can be activated");
      }

      await tx.widgetTheme.updateMany({
        where: { status: WidgetThemeStatus.ACTIVE },
        data: { status: WidgetThemeStatus.DRAFT }
      });

      return tx.widgetTheme.update({
        where: { id: draft.id },
        data: { status: WidgetThemeStatus.ACTIVE }
      });
    });

    res.json({ data: formatWidgetTheme(activated) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

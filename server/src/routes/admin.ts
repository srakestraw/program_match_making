import { Router } from "express";
import {
  ConversationPersona,
  ConversationScenarioStage,
  ConversationTurnRole,
  Prisma,
  ProgramTraitPriorityBucket,
  TraitCategory,
  TraitQuestionType
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

const idParamSchema = z.object({ id: z.string().min(1) });
const questionIdParamSchema = z.object({ questionId: z.string().min(1) });

const traitCategorySchema = z.nativeEnum(TraitCategory);
const traitQuestionTypeSchema = z.enum(["chat", "quiz"]);
const bucketSchema = z.nativeEnum(ProgramTraitPriorityBucket);
const conversationStageSchema = z.nativeEnum(ConversationScenarioStage);
const conversationPersonaSchema = z.nativeEnum(ConversationPersona);

const createTraitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: traitCategorySchema,
  definition: z.string().trim().max(1000).nullable().optional(),
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
  department: z.string().trim().max(120).nullable().optional()
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

const createSimulationSchema = z
  .object({
    scenarioId: z.string().min(1).optional(),
    persona: conversationPersonaSchema,
    customScenario: z.string().trim().min(1).max(4000).optional()
  })
  .refine((value) => Boolean(value.scenarioId || value.customScenario), {
    message: "scenarioId or customScenario is required"
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

const toNull = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toQuestionType = (value: "chat" | "quiz") => (value === "chat" ? TraitQuestionType.CHAT : TraitQuestionType.QUIZ);
const fromQuestionType = (value: TraitQuestionType) => (value === TraitQuestionType.CHAT ? "chat" : "quiz");

const formatTrait = (trait: {
  id: string;
  name: string;
  category: TraitCategory;
  definition: string | null;
  rubricScaleMin: number;
  rubricScaleMax: number;
  rubricPositiveSignals: string | null;
  rubricNegativeSignals: string | null;
  rubricFollowUps: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...trait,
  createdAt: trait.createdAt.toISOString(),
  updatedAt: trait.updatedAt.toISOString()
});

const formatQuestion = (question: {
  id: string;
  traitId: string;
  type: TraitQuestionType;
  prompt: string;
  optionsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: question.id,
  traitId: question.traitId,
  type: fromQuestionType(question.type),
  prompt: question.prompt,
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

export const adminRouter = Router();

adminRouter.get("/traits", async (req, res) => {
  try {
    const query = z
      .object({
        q: z.string().trim().optional(),
        category: traitCategorySchema.optional()
      })
      .parse(req.query);

    const traits = await prisma.trait.findMany({
      where: {
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q } },
                { definition: { contains: query.q } }
              ]
            }
          : {}),
        ...(query.category ? { category: query.category } : {})
      },
      orderBy: { name: "asc" }
    });

    res.json({ data: traits.map(formatTrait) });
  } catch (error) {
    res.status(400).json({ error: parseError(error) });
  }
});

adminRouter.post("/traits", async (req, res) => {
  try {
    const body = createTraitSchema.parse(req.body);
    const trait = await prisma.trait.create({
      data: {
        name: body.name,
        category: body.category,
        definition: toNull(body.definition),
        rubricScaleMin: body.rubricScaleMin,
        rubricScaleMax: body.rubricScaleMax,
        rubricPositiveSignals: toNull(body.rubricPositiveSignals),
        rubricNegativeSignals: toNull(body.rubricNegativeSignals),
        rubricFollowUps: toNull(body.rubricFollowUps)
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
    const trait = await prisma.trait.findUnique({ where: { id } });

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

    const trait = await prisma.trait.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.definition !== undefined ? { definition: toNull(body.definition) } : {}),
        ...(body.rubricScaleMin !== undefined ? { rubricScaleMin: body.rubricScaleMin } : {}),
        ...(body.rubricScaleMax !== undefined ? { rubricScaleMax: body.rubricScaleMax } : {}),
        ...(body.rubricPositiveSignals !== undefined
          ? { rubricPositiveSignals: toNull(body.rubricPositiveSignals) }
          : {}),
        ...(body.rubricNegativeSignals !== undefined
          ? { rubricNegativeSignals: toNull(body.rubricNegativeSignals) }
          : {}),
        ...(body.rubricFollowUps !== undefined ? { rubricFollowUps: toNull(body.rubricFollowUps) } : {})
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
        prompt: body.prompt,
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
        ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
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
        department: toNull(body.department)
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

adminRouter.put("/programs/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateProgramSchema.parse(req.body);
    const program = await prisma.program.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: toNull(body.description) } : {}),
        ...(body.degreeLevel !== undefined ? { degreeLevel: toNull(body.degreeLevel) } : {}),
        ...(body.department !== undefined ? { department: toNull(body.department) } : {})
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
      include: { trait: true },
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

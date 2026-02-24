import { Router } from "express";
import { Prisma, ProgramTraitPriorityBucket, TonePreset, TraitCategory, TraitQuestionType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const idParamSchema = z.object({ id: z.string().min(1) });
const questionIdParamSchema = z.object({ questionId: z.string().min(1) });

const traitCategorySchema = z.nativeEnum(TraitCategory);
const tonePresetSchema = z.nativeEnum(TonePreset);
const traitQuestionTypeSchema = z.enum(["chat", "quiz"]);
const bucketSchema = z.nativeEnum(ProgramTraitPriorityBucket);

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
  options: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  scoringHints: z.string().trim().max(2000).nullable().optional()
});

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

const createBrandVoiceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tonePreset: tonePresetSchema,
  doList: z.string().trim().max(2000).nullable().optional(),
  dontList: z.string().trim().max(2000).nullable().optional(),
  samplePhrases: z.string().trim().max(2000).nullable().optional()
});

const updateBrandVoiceSchema = createBrandVoiceSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
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
  scoringHints: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: question.id,
  traitId: question.traitId,
  type: fromQuestionType(question.type),
  prompt: question.prompt,
  options: question.optionsJson ? ((JSON.parse(question.optionsJson) as string[]) ?? []) : [],
  scoringHints: question.scoringHints,
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
  tonePreset: TonePreset;
  doList: string | null;
  dontList: string | null;
  samplePhrases: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...voice,
  createdAt: voice.createdAt.toISOString(),
  updatedAt: voice.updatedAt.toISOString()
});

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
        optionsJson: body.type === "quiz" ? JSON.stringify(body.options ?? []) : null,
        scoringHints: toNull(body.scoringHints)
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
        ...(body.options !== undefined ? { optionsJson: JSON.stringify(body.options) } : {}),
        ...(body.scoringHints !== undefined ? { scoringHints: toNull(body.scoringHints) } : {})
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
    const voice = await prisma.brandVoice.create({
      data: {
        name: body.name,
        tonePreset: body.tonePreset,
        doList: toNull(body.doList),
        dontList: toNull(body.dontList),
        samplePhrases: toNull(body.samplePhrases)
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
    const voice = await prisma.brandVoice.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.tonePreset !== undefined ? { tonePreset: body.tonePreset } : {}),
        ...(body.doList !== undefined ? { doList: toNull(body.doList) } : {}),
        ...(body.dontList !== undefined ? { dontList: toNull(body.dontList) } : {}),
        ...(body.samplePhrases !== undefined ? { samplePhrases: toNull(body.samplePhrases) } : {})
      }
    });

    res.json({ data: formatBrandVoice(voice) });
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

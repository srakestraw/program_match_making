import { PreferredChannel, ProgramTraitPriorityBucket, TraitQuestionType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { upsertCandidate } from "../lib/candidates.js";
import { sendError, sendValidationError } from "../lib/http.js";
import { createRateLimiter } from "../lib/rate-limit.js";

const bucketRank: Record<ProgramTraitPriorityBucket, number> = {
  CRITICAL: 0,
  VERY_IMPORTANT: 1,
  IMPORTANT: 2,
  NICE_TO_HAVE: 3
};

const querySchema = z.object({
  type: z.enum(["chat", "quiz"]).optional()
});

const idParamSchema = z.object({ id: z.string().min(1) });
const preferredChannelSchema = z.nativeEnum(PreferredChannel);
const createLeadSchema = z.object({
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  preferredChannel: preferredChannelSchema.nullable().optional(),
  programId: z.string().min(1).nullable().optional(),
  sessionId: z.string().min(1).nullable().optional()
}).refine((value) => Boolean(value.email || value.phone), {
  message: "Email or phone is required"
});

const toQuestionType = (value: "chat" | "quiz") => (value === "chat" ? TraitQuestionType.CHAT : TraitQuestionType.QUIZ);

const parseOptions = (optionsJson: string | null): string[] => {
  if (!optionsJson) return [];

  try {
    const parsed = JSON.parse(optionsJson);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // Ignore invalid stored JSON.
  }

  return [];
};

export const publicRouter = Router();
const leadRateLimit = createRateLimiter({
  name: "public-leads",
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.PUBLIC_RATE_LIMIT_LEAD_MAX ?? 20)
});

publicRouter.post("/leads", leadRateLimit, async (req, res) => {
  try {
    const body = createLeadSchema.parse(req.body);

    const candidate = await upsertCandidate(prisma, {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      preferredChannel: body.preferredChannel ?? null
    });

    if (body.sessionId) {
      await prisma.candidateSession.update({
        where: { id: body.sessionId },
        data: {
          candidateId: candidate.id,
          ...(body.programId ? { programId: body.programId } : {})
        }
      });
    }

    const lead = await prisma.lead.findFirst({
      where: {
        candidateId: candidate.id,
        ...(body.programId ? { programId: body.programId } : { programId: null })
      }
    });

    const savedLead =
      lead ??
      (await prisma.lead.create({
        data: {
          candidateId: candidate.id,
          programId: body.programId ?? null,
          source: "widget",
          status: "NEW"
        }
      }));

    res.status(201).json({
      candidateId: candidate.id,
      leadId: savedLead.id
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not create lead");
  }
});

publicRouter.get("/programs", async (_req, res) => {
  try {
    const programs = await prisma.program.findMany({
      orderBy: { name: "asc" }
    });

    res.json({
      data: programs.map((program) => ({
        id: program.id,
        name: program.name,
        description: program.description
      }))
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not fetch programs");
  }
});

publicRouter.get("/programs/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        traits: {
          include: {
            trait: true
          }
        }
      }
    });

    if (!program) {
      sendError(res, 404, "Program not found");
      return;
    }

    const orderedTraits = [...program.traits].sort((a, b) => {
      const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.sortOrder - b.sortOrder;
    });

    res.json({
      data: {
        id: program.id,
        name: program.name,
        description: program.description,
        traits: orderedTraits.map((item) => ({
          id: item.id,
          traitId: item.traitId,
          bucket: item.bucket,
          sortOrder: item.sortOrder,
          notes: item.notes,
          trait: {
            id: item.trait.id,
            name: item.trait.name,
            category: item.trait.category,
            definition: item.trait.definition
          }
        }))
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not fetch program");
  }
});

publicRouter.get("/programs/:id/questions", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { type } = querySchema.parse(req.query);

    const program = await prisma.program.findUnique({ where: { id } });
    if (!program) {
      sendError(res, 404, "Program not found");
      return;
    }

    const rows = await prisma.programTrait.findMany({
      where: { programId: id },
      include: {
        trait: {
          include: {
            questions: type
              ? {
                  where: { type: toQuestionType(type) },
                  orderBy: { createdAt: "asc" }
                }
              : {
                  orderBy: { createdAt: "asc" }
                }
          }
        }
      }
    });

    const orderedTraits = [...rows].sort((a, b) => {
      const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.sortOrder - b.sortOrder;
    });

    const grouped = orderedTraits.map((row) => ({
      traitId: row.traitId,
      traitName: row.trait.name,
      bucket: row.bucket,
      sortOrder: row.sortOrder,
      questions: row.trait.questions.map((question) => ({
        id: question.id,
        traitId: question.traitId,
        prompt: question.prompt,
        type: question.type === TraitQuestionType.CHAT ? "chat" : "quiz",
        options: parseOptions(question.optionsJson)
      }))
    }));

    const orderedQuestions = grouped.flatMap((group) =>
      group.questions.map((question) => ({
        ...question,
        traitName: group.traitName,
        bucket: group.bucket,
        traitSortOrder: group.sortOrder
      }))
    );

    res.json({
      data: {
        programId: program.id,
        type: type ?? "all",
        grouped,
        orderedQuestions
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not fetch questions");
  }
});

import { ProgramTraitPriorityBucket, TraitQuestionType } from "@prisma/client";
import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendError, sendValidationError } from "../lib/http.js";
import { incrementMetric } from "../lib/metrics.js";
import { createRateLimiter } from "../lib/rate-limit.js";
import { fetchOpenAiWithRetry } from "../lib/openai.js";
import { computeProgramFit, type ScoringSnapshot, type SnapshotConfidence } from "../lib/program-fit.js";

const bucketRank: Record<ProgramTraitPriorityBucket, number> = {
  CRITICAL: 0,
  VERY_IMPORTANT: 1,
  IMPORTANT: 2,
  NICE_TO_HAVE: 3
};

const bucketWeights: Record<ProgramTraitPriorityBucket, number> = {
  CRITICAL: 1,
  VERY_IMPORTANT: 0.8,
  IMPORTANT: 0.6,
  NICE_TO_HAVE: 0.4
};

const createSessionSchema = z.object({
  mode: z.enum(["voice", "chat", "quiz"]),
  candidateId: z.string().min(1).optional(),
  programId: z.string().min(1).optional()
});

const transcriptTurnSchema = z.object({
  ts: z.string().datetime(),
  speaker: z.enum(["candidate", "assistant"]),
  text: z.string().trim().min(1).max(4000)
});

const transcriptSchema = z.object({
  turns: z.array(transcriptTurnSchema).max(200)
});

const responseSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().trim().min(1).max(2000)
});

const scoreSchema = z.object({
  mode: z.enum(["chat", "quiz"]),
  programId: z.string().min(1),
  transcriptTurns: z.array(transcriptTurnSchema).max(200).optional(),
  responses: z.array(responseSchema).max(100).optional(),
  activeTraitId: z.string().min(1).optional()
});

const voiceTurnSchema = scoreSchema.extend({
  sessionId: z.string().min(1)
});

const voiceEndSchema = z.object({
  sessionId: z.string().min(1)
});

const parseJsonObject = (value: string | null): Record<string, unknown> | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const parseOptions = (optionsJson: string | null): string[] => {
  if (!optionsJson) return [];

  try {
    const parsed = JSON.parse(optionsJson);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // Ignore invalid persisted JSON.
  }

  return [];
};

const clampScore = (value: number) => {
  if (!Number.isFinite(value)) return 2.5;
  return Math.max(0, Math.min(5, value));
};

const defaultScoreForIndex = (index: number, total: number) => {
  if (total <= 1) return 2.5;
  return (index / (total - 1)) * 5;
};

const parseInlineOptionScore = (option: string) => {
  const bracket = option.match(/^(.*)\[\s*([0-5](?:\.\d+)?)\s*\]\s*$/);
  if (bracket) {
    return { label: bracket[1]?.trim() ?? option.trim(), score: clampScore(Number(bracket[2])) };
  }

  const paren = option.match(/^(.*)\(\s*([0-5](?:\.\d+)?)\s*\)\s*$/);
  if (paren) {
    return { label: paren[1]?.trim() ?? option.trim(), score: clampScore(Number(paren[2])) };
  }

  return { label: option.trim(), score: null as number | null };
};

const confidenceFromCoverage = (answeredCount: number, totalCount: number) => {
  if (totalCount <= 0) return 0.35;
  const ratio = answeredCount / totalCount;
  return Math.max(0.35, Math.min(0.95, 0.35 + ratio * 0.6));
};

const normalizeText = (value: string) => value.trim().toLowerCase();

type ScorecardTraitResult = {
  traitId: string;
  traitName: string;
  bucket: ProgramTraitPriorityBucket;
  score0to5: number;
  confidence: number;
  evidence: string[];
  rationale: string | null;
  traitQuestionId: string | null;
};

const computeOverallScore = (items: ScorecardTraitResult[]) => {
  if (items.length === 0) {
    return 0;
  }

  const weightedTotal = items.reduce((acc, item) => acc + item.score0to5 * bucketWeights[item.bucket], 0);
  const totalWeight = items.reduce((acc, item) => acc + bucketWeights[item.bucket], 0);

  return totalWeight > 0 ? Number((weightedTotal / totalWeight).toFixed(2)) : 0;
};

const computeQuizTraitScores = (input: {
  programTraits: Array<{
    traitId: string;
    bucket: ProgramTraitPriorityBucket;
    sortOrder: number;
    trait: {
      name: string;
      questions: Array<{
        id: string;
        prompt: string;
        optionsJson: string | null;
        scoringHints: string | null;
      }>;
    };
  }>;
  responses: Array<{ questionId: string; answer: string }>;
  transcriptTurns: Array<{ speaker: "candidate" | "assistant"; text: string }>;
}) => {
  const responseMap = new Map(input.responses.map((item) => [item.questionId, item.answer]));
  const candidateTurns = input.transcriptTurns.filter((turn) => turn.speaker === "candidate");
  let fallbackCandidateIndex = 0;

  return [...input.programTraits]
    .sort((a, b) => {
      const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.sortOrder - b.sortOrder;
    })
    .map((row) => {
      const traitQuestionScores: number[] = [];
      const evidence: string[] = [];
      let answeredCount = 0;
      let lastAnsweredQuestionId: string | null = null;

      for (const question of row.trait.questions) {
        const options = parseOptions(question.optionsJson);
        const hintObject = parseJsonObject(question.scoringHints);
        const optionScoresByText =
          hintObject && typeof hintObject.optionScores === "object" && hintObject.optionScores !== null
            ? (hintObject.optionScores as Record<string, unknown>)
            : null;

        const selectedAnswer = responseMap.get(question.id) ?? candidateTurns[fallbackCandidateIndex]?.text;
        if (!responseMap.has(question.id) && selectedAnswer) {
          fallbackCandidateIndex += 1;
        }

        if (!selectedAnswer) {
          continue;
        }

        answeredCount += 1;
        lastAnsweredQuestionId = question.id;

        const normalizedAnswer = normalizeText(selectedAnswer);
        const parsedOptions = options.map((option) => parseInlineOptionScore(option));

        const selectedIndex = parsedOptions.findIndex((option) => normalizeText(option.label) === normalizedAnswer);

        let questionScore = 2.5;

        if (selectedIndex >= 0) {
          const selectedOption = parsedOptions[selectedIndex];

          if (selectedOption.score !== null) {
            questionScore = selectedOption.score;
          } else if (optionScoresByText) {
            const byExact = optionScoresByText[selectedOption.label];
            const byIndex = optionScoresByText[String(selectedIndex)];
            const hinted = typeof byExact === "number" ? byExact : typeof byIndex === "number" ? byIndex : null;
            if (hinted !== null) {
              questionScore = clampScore(hinted);
            } else {
              questionScore = defaultScoreForIndex(selectedIndex, parsedOptions.length);
            }
          } else {
            questionScore = defaultScoreForIndex(selectedIndex, parsedOptions.length);
          }
        } else {
          const numericValue = Number(selectedAnswer);
          if (Number.isFinite(numericValue)) {
            questionScore = clampScore(numericValue);
          }
        }

        traitQuestionScores.push(questionScore);
        evidence.push(`Q: ${question.prompt} A: ${selectedAnswer}`);
      }

      const score0to5 =
        traitQuestionScores.length > 0
          ? Number((traitQuestionScores.reduce((acc, score) => acc + score, 0) / traitQuestionScores.length).toFixed(2))
          : 2.5;

      return {
        traitId: row.traitId,
        traitName: row.trait.name,
        bucket: row.bucket,
        score0to5,
        confidence: Number(confidenceFromCoverage(answeredCount, row.trait.questions.length).toFixed(2)),
        evidence: evidence.length > 0 ? evidence : ["No quiz response captured for this trait."],
        rationale:
          answeredCount > 0
            ? `Averaged ${answeredCount} quiz response${answeredCount === 1 ? "" : "s"} for this trait.`
            : "No quiz response captured for this trait yet.",
        traitQuestionId: lastAnsweredQuestionId
      } satisfies ScorecardTraitResult;
    });
};

const computeChatTraitScores = async (input: {
  transcriptTurns: Array<{ speaker: "candidate" | "assistant"; text: string }>;
  programTraits: Array<{ traitId: string; bucket: ProgramTraitPriorityBucket; sortOrder: number; trait: { name: string } }>;
}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const transcriptText = input.transcriptTurns.map((turn, index) => `${index + 1}. ${turn.speaker.toUpperCase()}: ${turn.text}`).join("\n");

  const traitListText = [...input.programTraits]
    .sort((a, b) => {
      const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.sortOrder - b.sortOrder;
    })
    .map((item) => `- ${item.traitId}: ${item.trait.name} (${item.bucket})`)
    .join("\n");

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You score candidate transcript evidence against traits. Return strict JSON with key perTrait. Each item: traitId, score0to5 (number), confidence (0-1), evidence (array of short quotes or paraphrases)."
        },
        {
          role: "user",
          content: `Traits:\n${traitListText}\n\nTranscript:\n${transcriptText}\n\nReturn JSON: {"perTrait":[...]}. Score 0-5.`
        }
      ]
    })
  });

  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "Failed to score chat session";
    throw new Error(`OPENAI_UPSTREAM: ${message}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Chat scoring returned an invalid response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Chat scoring JSON parse failed");
  }

  const rawPerTrait: any[] = Array.isArray(parsed?.perTrait) ? parsed.perTrait : [];
  const byTraitId = new Map(rawPerTrait.map((item) => [String(item?.traitId ?? ""), item]));

  return [...input.programTraits]
    .sort((a, b) => {
      const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.sortOrder - b.sortOrder;
    })
    .map((item) => {
      const modelValue = byTraitId.get(item.traitId);
      const evidence = Array.isArray(modelValue?.evidence)
        ? modelValue.evidence.map((entry: unknown) => String(entry)).filter((entry: string) => entry.length > 0)
        : [];

      return {
        traitId: item.traitId,
        traitName: item.trait.name,
        bucket: item.bucket,
        score0to5: clampScore(Number(modelValue?.score0to5 ?? 2.5)),
        confidence: Math.max(0, Math.min(1, Number(modelValue?.confidence ?? 0.5))),
        evidence: evidence.length > 0 ? evidence : ["No concrete evidence returned by model."],
        rationale: typeof modelValue?.rationale === "string" ? modelValue.rationale.trim().slice(0, 600) : null,
        traitQuestionId: null
      } satisfies ScorecardTraitResult;
    });
};

const buildScorecardResponse = (scorecard: {
  id: string;
  sessionId: string;
  programId: string;
  overallScore: number;
  createdAt: Date;
  traitScores: Array<{
    id: string;
    traitId: string;
    bucket: ProgramTraitPriorityBucket;
    score0to5: number;
    confidence: number;
    evidenceJson: string;
    rationale: string | null;
    trait: { name: string };
  }>;
}) => ({
  id: scorecard.id,
  sessionId: scorecard.sessionId,
  programId: scorecard.programId,
  overallScore: scorecard.overallScore,
  createdAt: scorecard.createdAt.toISOString(),
  perTrait: scorecard.traitScores.map((item) => ({
    traitId: item.traitId,
    traitName: item.trait.name,
    bucket: item.bucket,
    score0to5: item.score0to5,
    confidence: item.confidence,
    rationale: item.rationale,
    evidence: (() => {
      try {
        const parsed = JSON.parse(item.evidenceJson);
        return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
      } catch {
        return [];
      }
    })()
  }))
});

const mapConfidence = (value: number | null): SnapshotConfidence => {
  if (value === null) return null;
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "medium";
  return "low";
};

const buildScoringSnapshot = (input: {
  programTraits: Array<{
    traitId: string;
    bucket: ProgramTraitPriorityBucket;
    sortOrder: number;
    trait: { name: string };
  }>;
  scorecard:
    | {
        traitScores: Array<{
          traitId: string;
          score0to5: number;
          confidence: number;
          evidenceJson: string;
          rationale: string | null;
          traitQuestionId: string | null;
        }>;
      }
    | null;
  activeTraitId?: string;
}): ScoringSnapshot => {
  const scoreByTrait = new Map(
    (input.scorecard?.traitScores ?? []).map((trait) => [
      trait.traitId,
      {
        score_1_to_5: Number(Math.max(1, Math.min(5, trait.score0to5)).toFixed(2)),
        confidence: mapConfidence(trait.confidence),
        evidence: (() => {
          try {
            const parsed = JSON.parse(trait.evidenceJson);
            return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
          } catch {
            return [];
          }
        })(),
        rationale: trait.rationale,
        answered: trait.traitQuestionId !== null || trait.evidenceJson !== JSON.stringify(["No quiz response captured for this trait."])
      }
    ])
  );

  const orderedTraits = [...input.programTraits].sort((a, b) => {
    const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
    if (bucketDiff !== 0) return bucketDiff;
    return a.sortOrder - b.sortOrder;
  });

  const fallbackActiveTraitId =
    input.activeTraitId ??
    orderedTraits.find((item) => {
      const trait = scoreByTrait.get(item.traitId);
      return !trait?.answered;
    })?.traitId ??
    null;

  return {
    traits: orderedTraits.map((trait) => {
      const scored = scoreByTrait.get(trait.traitId);
      const status = fallbackActiveTraitId === trait.traitId ? "active" : scored?.answered ? "complete" : "unanswered";

      return {
        traitId: trait.traitId,
        traitName: trait.trait.name,
        score_1_to_5: scored?.answered ? scored.score_1_to_5 : null,
        confidence: scored?.answered ? scored.confidence : null,
        evidence: scored?.evidence ?? [],
        rationale: scored?.rationale ?? null,
        status
      };
    })
  };
};

const loadProgramTraits = async (programId: string, mode: "chat" | "quiz") =>
  prisma.programTrait.findMany({
    where: { programId },
    include: {
      trait: {
        include: {
          questions:
            mode === "quiz"
              ? {
                  where: { type: TraitQuestionType.QUIZ },
                  orderBy: { createdAt: "asc" }
                }
              : false
        }
      }
    }
  });

const buildSessionInsights = async (input: {
  sessionId: string;
  programId: string;
  mode: "chat" | "quiz";
  activeTraitId?: string;
}) => {
  const [programTraits, scorecard] = await Promise.all([
    loadProgramTraits(input.programId, input.mode),
    prisma.scorecard.findFirst({
      where: { sessionId: input.sessionId, programId: input.programId },
      orderBy: { createdAt: "desc" },
      include: {
        traitScores: true
      }
    })
  ]);

  const scoringSnapshot = buildScoringSnapshot({
    programTraits: programTraits.map((item) => ({
      traitId: item.traitId,
      bucket: item.bucket,
      sortOrder: item.sortOrder,
      trait: { name: item.trait.name }
    })),
    scorecard,
    activeTraitId: input.activeTraitId
  });

  const programFit = await computeProgramFit(input.sessionId, scoringSnapshot);

  return {
    scoring_snapshot: scoringSnapshot,
    program_fit: programFit
  };
};

export const sessionsRouter = Router();
const scoreRateLimit = createRateLimiter({
  name: "session-score",
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.PUBLIC_RATE_LIMIT_SCORE_MAX ?? 20)
});

export const createScorecardForSession = async (input: {
  sessionId: string;
  mode: "chat" | "quiz";
  programId: string;
  transcriptTurns?: Array<{ ts: string; speaker: "candidate" | "assistant"; text: string }>;
  responses?: Array<{ questionId: string; answer: string }>;
  activeTraitId?: string;
}) => {
  const [session, program] = await Promise.all([
    prisma.candidateSession.findUnique({ where: { id: input.sessionId } }),
    prisma.program.findUnique({ where: { id: input.programId } })
  ]);

  if (!session) {
    throw new Error("Session not found");
  }

  if (!program) {
    throw new Error("Program not found");
  }

  const transcriptTurns = input.transcriptTurns
    ? input.transcriptTurns
    : (
        await prisma.transcriptTurn.findMany({
          where: { sessionId: input.sessionId },
          orderBy: { ts: "asc" }
        })
      ).map((turn) => ({
        ts: turn.ts.toISOString(),
        speaker: turn.speaker as "candidate" | "assistant",
        text: turn.text
      }));

  const programTraits = await loadProgramTraits(input.programId, input.mode);

  const perTrait =
    input.mode === "quiz"
      ? computeQuizTraitScores({
          programTraits: programTraits.map((item) => ({
            traitId: item.traitId,
            bucket: item.bucket,
            sortOrder: item.sortOrder,
            trait: {
              name: item.trait.name,
              questions: item.trait.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                optionsJson: question.optionsJson,
                scoringHints: question.scoringHints
              }))
            }
          })),
          responses: input.responses ?? [],
          transcriptTurns: transcriptTurns.map((turn) => ({
            speaker: turn.speaker,
            text: turn.text
          }))
        })
      : await computeChatTraitScores({
          transcriptTurns: transcriptTurns.map((turn) => ({
            speaker: turn.speaker,
            text: turn.text
          })),
          programTraits: programTraits.map((item) => ({
            traitId: item.traitId,
            bucket: item.bucket,
            sortOrder: item.sortOrder,
            trait: { name: item.trait.name }
          }))
        });

  const overallScore = computeOverallScore(perTrait);

  const persisted = await prisma.$transaction(async (tx) => {
    await tx.scorecard.deleteMany({ where: { sessionId: input.sessionId, programId: input.programId } });

    const scorecard = await tx.scorecard.create({
      data: {
        sessionId: input.sessionId,
        programId: input.programId,
        overallScore,
        traitScores: {
          create: perTrait.map((item) => ({
            traitId: item.traitId,
            bucket: item.bucket,
            score0to5: Number(item.score0to5.toFixed(2)),
            confidence: Number(item.confidence.toFixed(2)),
            evidenceJson: JSON.stringify(item.evidence),
            rationale: item.rationale,
            traitQuestionId: item.traitQuestionId
          }))
        }
      },
      include: {
        traitScores: {
          include: {
            trait: {
              select: { name: true }
            }
          }
        }
      }
    });

    return scorecard;
  });

  const scorecard = buildScorecardResponse(persisted);
  const insights = await buildSessionInsights({
    sessionId: input.sessionId,
    programId: input.programId,
    mode: input.mode,
    activeTraitId: input.activeTraitId
  });

  return {
    ...scorecard,
    ...insights
  };
};

const createSession = async (body: z.infer<typeof createSessionSchema>) => {
  const session = await prisma.candidateSession.create({
    data: {
      mode: body.mode,
      channel: body.mode === "voice" ? "WEB_VOICE" : body.mode === "chat" ? "WEB_CHAT" : "WEB_QUIZ",
      status: "active",
      ...(body.candidateId ? { candidateId: body.candidateId } : {}),
      ...(body.programId ? { programId: body.programId } : {})
    }
  });

  const baseResponse = {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt.toISOString()
  };

  if (!body.programId || body.mode === "voice") {
    return baseResponse;
  }

  const insights = await buildSessionInsights({
    sessionId: session.id,
    programId: body.programId,
    mode: body.mode
  });

  return {
    ...baseResponse,
    ...insights
  };
};

const sendScoreError = (res: Response, error: unknown) => {
  incrementMetric("scoring.failed");
  if (error instanceof z.ZodError) {
    sendValidationError(res, error);
    return;
  }

  const rawMessage = error instanceof Error ? error.message : "Could not score session";
  const message = rawMessage.replace(/^OPENAI_UPSTREAM:\s*/i, "");
  const openAiRelated = /OPENAI|OpenAI|chat scoring/i.test(rawMessage);
  if (message === "Session not found" || message === "Program not found") {
    sendError(res, 404, message);
    return;
  }
  sendError(res, openAiRelated ? 502 : 400, message, undefined, openAiRelated ? "SCORING_UPSTREAM_FAILED" : undefined);
};

sessionsRouter.post("/", async (req, res) => {
  try {
    const body = createSessionSchema.parse(req.body);
    const session = await createSession(body);

    incrementMetric("sessions.created");
    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Invalid payload");
  }
});

sessionsRouter.post("/:id/transcript", async (req, res) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = transcriptSchema.parse(req.body);

    await prisma.transcriptTurn.createMany({
      data: body.turns.map((turn) => ({
        sessionId: id,
        ts: new Date(turn.ts),
        speaker: turn.speaker,
        text: turn.text
      }))
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Invalid payload");
  }
});

sessionsRouter.post("/:id/score", scoreRateLimit, async (req, res) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = scoreSchema.parse(req.body);
    const result = await createScorecardForSession({
      sessionId: id,
      mode: body.mode,
      programId: body.programId,
      transcriptTurns: body.transcriptTurns,
      responses: body.responses,
      activeTraitId: body.activeTraitId
    });

    incrementMetric("scoring.success");
    res.json({ data: result });
  } catch (error) {
    sendScoreError(res, error);
  }
});

sessionsRouter.post("/:id/complete", async (req, res) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const session = await prisma.candidateSession.update({
      where: { id },
      data: {
        status: "completed",
        endedAt: new Date()
      },
      include: { program: true }
    });

    incrementMetric("sessions.completed");
    const baseResponse = {
      id: session.id,
      status: session.status,
      endedAt: session.endedAt?.toISOString() ?? null
    };

    if (!session.programId || (session.mode !== "chat" && session.mode !== "quiz")) {
      res.json(baseResponse);
      return;
    }

    const insights = await buildSessionInsights({
      sessionId: session.id,
      programId: session.programId,
      mode: session.mode as "chat" | "quiz"
    });

    res.json({
      ...baseResponse,
      done: true,
      ...insights
    });
  } catch (error) {
    incrementMetric("sessions.failed");
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not complete session");
  }
});

sessionsRouter.post("/start", async (req, res) => {
  try {
    const body = createSessionSchema.parse(req.body);
    const session = await createSession(body);

    incrementMetric("sessions.created");
    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Invalid payload");
  }
});

sessionsRouter.post("/turn", scoreRateLimit, async (req, res) => {
  try {
    const body = voiceTurnSchema.parse(req.body);
    const result = await createScorecardForSession({
      sessionId: body.sessionId,
      mode: body.mode,
      programId: body.programId,
      transcriptTurns: body.transcriptTurns,
      responses: body.responses,
      activeTraitId: body.activeTraitId
    });

    incrementMetric("scoring.success");
    res.json({ data: result });
  } catch (error) {
    sendScoreError(res, error);
  }
});

sessionsRouter.post("/end", async (req, res) => {
  try {
    const body = voiceEndSchema.parse(req.body);
    const session = await prisma.candidateSession.update({
      where: { id: body.sessionId },
      data: {
        status: "completed",
        endedAt: new Date()
      },
      include: { program: true }
    });

    const baseResponse = {
      id: session.id,
      status: session.status,
      endedAt: session.endedAt?.toISOString() ?? null
    };

    if (!session.programId || (session.mode !== "chat" && session.mode !== "quiz")) {
      res.json(baseResponse);
      return;
    }

    const insights = await buildSessionInsights({
      sessionId: session.id,
      programId: session.programId,
      mode: session.mode as "chat" | "quiz"
    });

    incrementMetric("sessions.completed");
    res.json({
      ...baseResponse,
      done: true,
      ...insights
    });
  } catch (error) {
    incrementMetric("sessions.failed");
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not complete session");
  }
});

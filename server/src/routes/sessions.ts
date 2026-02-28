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
import {
  aggregateTraitQuestionEvaluations,
  buildTraitScoringPrompt,
  evaluateTraitQuestionResponse,
  splitRubricSignals,
  type TraitQuestionEvaluation
} from "../lib/trait-scoring.js";
import { createInterviewSession, handleCheckpointAction, handleInterviewTurn } from "../lib/interview-engine.js";

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
  mode: z.enum(["voice", "chat", "quiz"]),
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

const interviewCreateSchema = z.object({
  mode: z.enum(["voice", "chat", "quiz"]),
  candidateId: z.string().min(1).optional(),
  brandVoiceId: z.string().min(1).optional(),
  language: z.string().trim().min(2).max(8).optional(),
  programFilterIds: z.array(z.string().min(1)).max(24).optional(),
  programId: z.string().min(1).optional()
});

const interviewTurnSchema = z.object({
  mode: z.enum(["voice", "chat", "quiz"]),
  text: z.string().trim().min(1).max(4000),
  language: z.string().trim().min(2).max(8).optional(),
  traitId: z.string().min(1).optional(),
  questionId: z.string().min(1).optional(),
  askedTraitIds: z.array(z.string().min(1)).max(100).optional(),
  askedQuestionIds: z.array(z.string().min(1)).max(200).optional(),
  preferredTraitIds: z.array(z.string().min(1)).max(10).optional(),
  programFilterIds: z.array(z.string().min(1)).max(24).optional()
});

const interviewCheckpointSchema = z.object({
  mode: z.enum(["voice", "chat", "quiz"]),
  action: z.enum(["stop", "continue", "focus"]),
  language: z.string().trim().min(2).max(8).optional(),
  focusTraitIds: z.array(z.string().min(1)).max(10).optional(),
  askedTraitIds: z.array(z.string().min(1)).max(100).optional(),
  askedQuestionIds: z.array(z.string().min(1)).max(200).optional(),
  programFilterIds: z.array(z.string().min(1)).max(24).optional()
});

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

const confidenceFromCoverage = (answeredCount: number, totalCount: number) => {
  if (totalCount <= 0) return 0.35;
  const ratio = answeredCount / totalCount;
  return Math.max(0.35, Math.min(0.95, 0.35 + ratio * 0.6));
};

type ScorecardTraitResult = {
  traitId: string;
  traitName: string;
  bucket: ProgramTraitPriorityBucket;
  score0to5: number;
  confidence: number;
  evidence: string[];
  rationale: string | null;
  traitQuestionId: string | null;
  matchedPositiveSignals: string[];
  matchedNegativeSignals: string[];
  questionEvaluations: TraitQuestionEvaluation[];
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
      definition: string | null;
      rubricPositiveSignals: string | null;
      rubricNegativeSignals: string | null;
      questions: Array<{
        id: string;
        prompt: string;
        type: "chat" | "quiz";
        optionsJson: string | null;
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
      const questionEvaluations: TraitQuestionEvaluation[] = [];
      let answeredCount = 0;
      let lastAnsweredQuestionId: string | null = null;
      const positiveSignals = splitRubricSignals(row.trait.rubricPositiveSignals);
      const negativeSignals = splitRubricSignals(row.trait.rubricNegativeSignals);

      for (const question of row.trait.questions) {
        const options = parseOptions(question.optionsJson);

        const selectedAnswer = responseMap.get(question.id) ?? candidateTurns[fallbackCandidateIndex]?.text;
        if (!responseMap.has(question.id) && selectedAnswer) {
          fallbackCandidateIndex += 1;
        }

        if (!selectedAnswer) {
          continue;
        }

        answeredCount += 1;
        lastAnsweredQuestionId = question.id;

        questionEvaluations.push(
          evaluateTraitQuestionResponse({
            trait: {
              traitId: row.traitId,
              traitName: row.trait.name,
              traitDefinition: row.trait.definition,
              positiveSignals,
              negativeSignals
            },
            question: {
              questionId: question.id,
              questionPrompt: question.prompt,
              questionType: question.type,
              optionLabels: options
            },
            answer: selectedAnswer
          })
        );
      }

      const aggregate = aggregateTraitQuestionEvaluations(questionEvaluations);

      return {
        traitId: row.traitId,
        traitName: row.trait.name,
        bucket: row.bucket,
        score0to5: aggregate.score0to5,
        confidence: Number(
          Math.max(
            aggregate.confidence,
            confidenceFromCoverage(answeredCount, Math.max(1, row.trait.questions.length))
          ).toFixed(2)
        ),
        evidence: aggregate.evidence,
        rationale:
          answeredCount > 0
            ? aggregate.rationale
            : "No quiz response captured for this trait yet.",
        traitQuestionId: lastAnsweredQuestionId,
        matchedPositiveSignals: aggregate.matchedPositiveSignals,
        matchedNegativeSignals: aggregate.matchedNegativeSignals,
        questionEvaluations: aggregate.questionEvaluations
      } satisfies ScorecardTraitResult;
    });
};

const computeChatTraitScores = async (input: {
  transcriptTurns: Array<{ speaker: "candidate" | "assistant"; text: string }>;
  programTraits: Array<{
    traitId: string;
    bucket: ProgramTraitPriorityBucket;
    sortOrder: number;
    trait: {
      name: string;
      definition: string | null;
      rubricPositiveSignals: string | null;
      rubricNegativeSignals: string | null;
      questions: Array<{
        id: string;
        prompt: string;
        type: "chat" | "quiz";
        optionsJson: string | null;
      }>;
    };
  }>;
}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const candidateTurns = input.transcriptTurns.filter((turn) => turn.speaker === "candidate");
  const sortedTraits = [...input.programTraits]
    .sort((a, b) => {
      const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.sortOrder - b.sortOrder;
    });

  const transcriptText = input.transcriptTurns.map((turn, index) => `${index + 1}. ${turn.speaker.toUpperCase()}: ${turn.text}`).join("\n");

  const traitListText = sortedTraits
    .map((item) =>
      buildTraitScoringPrompt({
        trait: {
          traitId: item.traitId,
          traitName: item.trait.name,
          traitDefinition: item.trait.definition,
          positiveSignals: splitRubricSignals(item.trait.rubricPositiveSignals),
          negativeSignals: splitRubricSignals(item.trait.rubricNegativeSignals)
        },
        questions: item.trait.questions.map((question) => ({
          questionId: question.id,
          questionPrompt: question.prompt,
          questionType: question.type,
          optionLabels: parseOptions(question.optionsJson)
        })),
        candidateTurns
      })
    )
    .join("\n\n---\n\n");

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
            "You score candidate evidence by trait rubric signals. Return strict JSON: {\"perTrait\":[{traitId,score0to5,confidence,rationale,evidence,matched_positive_signals,matched_negative_signals,traitQuestionId}]}. score0to5 must be 0-5. confidence must be 0-1."
        },
        {
          role: "user",
          content: `Score each trait using only the provided trait rubric context and question context.\n\nTrait Context:\n${traitListText}\n\nTranscript:\n${transcriptText}`
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

  return sortedTraits.map((item) => {
      const modelValue = byTraitId.get(item.traitId);
      const evidence = Array.isArray(modelValue?.evidence)
        ? modelValue.evidence.map((entry: unknown) => String(entry)).filter((entry: string) => entry.length > 0)
        : [];
      const modelMatchedPositiveSignals = Array.isArray(modelValue?.matched_positive_signals)
        ? modelValue.matched_positive_signals.map((entry: unknown) => String(entry)).filter((entry: string) => entry.length > 0)
        : [];
      const modelMatchedNegativeSignals = Array.isArray(modelValue?.matched_negative_signals)
        ? modelValue.matched_negative_signals.map((entry: unknown) => String(entry)).filter((entry: string) => entry.length > 0)
        : [];

      const questionEvaluations: TraitQuestionEvaluation[] = item.trait.questions.map((question) =>
        evaluateTraitQuestionResponse({
          trait: {
            traitId: item.traitId,
            traitName: item.trait.name,
            traitDefinition: item.trait.definition,
            positiveSignals: splitRubricSignals(item.trait.rubricPositiveSignals),
            negativeSignals: splitRubricSignals(item.trait.rubricNegativeSignals)
          },
          question: {
            questionId: question.id,
            questionPrompt: question.prompt,
            questionType: question.type,
            optionLabels: parseOptions(question.optionsJson)
          },
          answer: candidateTurns.map((turn) => turn.text).join("\n")
        })
      );

      const aggregate = aggregateTraitQuestionEvaluations(questionEvaluations);

      return {
        traitId: item.traitId,
        traitName: item.trait.name,
        bucket: item.bucket,
        score0to5: clampScore(Number(modelValue?.score0to5 ?? 2.5)),
        confidence: Math.max(0, Math.min(1, Number(modelValue?.confidence ?? 0.5))),
        evidence: evidence.length > 0 ? evidence : aggregate.evidence,
        rationale: typeof modelValue?.rationale === "string" ? modelValue.rationale.trim().slice(0, 600) : null,
        traitQuestionId: typeof modelValue?.traitQuestionId === "string" ? modelValue.traitQuestionId : null,
        matchedPositiveSignals: modelMatchedPositiveSignals.length > 0 ? modelMatchedPositiveSignals : aggregate.matchedPositiveSignals,
        matchedNegativeSignals: modelMatchedNegativeSignals.length > 0 ? modelMatchedNegativeSignals : aggregate.matchedNegativeSignals,
        questionEvaluations
      } satisfies ScorecardTraitResult;
    });
};

type StoredTraitScoreDetails = {
  evidence: string[];
  matched_positive_signals: string[];
  matched_negative_signals: string[];
  question_scores: Array<{
    questionId: string;
    questionPrompt: string;
    questionType: "chat" | "quiz";
    score0to5: number;
    rationale: string;
    evidence: string[];
    matchedPositiveSignals: string[];
    matchedNegativeSignals: string[];
    confidence: number;
    weight: number;
  }>;
};

const parseStoredTraitScoreDetails = (raw: string): StoredTraitScoreDetails => {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        evidence: parsed.map((entry) => String(entry)),
        matched_positive_signals: [],
        matched_negative_signals: [],
        question_scores: []
      };
    }
    if (parsed && typeof parsed === "object") {
      const value = parsed as Record<string, unknown>;
      return {
        evidence: Array.isArray(value.evidence) ? value.evidence.map((entry) => String(entry)) : [],
        matched_positive_signals: Array.isArray(value.matched_positive_signals)
          ? value.matched_positive_signals.map((entry) => String(entry))
          : [],
        matched_negative_signals: Array.isArray(value.matched_negative_signals)
          ? value.matched_negative_signals.map((entry) => String(entry))
          : [],
        question_scores: Array.isArray(value.question_scores)
          ? value.question_scores
              .map((entry) => {
                if (!entry || typeof entry !== "object") return null;
                const row = entry as Record<string, unknown>;
                return {
                  questionId: String(row.questionId ?? ""),
                  questionPrompt: String(row.questionPrompt ?? ""),
                  questionType: row.questionType === "quiz" ? "quiz" : "chat",
                  score0to5: clampScore(Number(row.score0to5 ?? 2.5)),
                  rationale: String(row.rationale ?? ""),
                  evidence: Array.isArray(row.evidence) ? row.evidence.map((item) => String(item)) : [],
                  matchedPositiveSignals: Array.isArray(row.matchedPositiveSignals)
                    ? row.matchedPositiveSignals.map((item) => String(item))
                    : [],
                  matchedNegativeSignals: Array.isArray(row.matchedNegativeSignals)
                    ? row.matchedNegativeSignals.map((item) => String(item))
                    : [],
                  confidence: Math.max(0, Math.min(1, Number(row.confidence ?? 0.5))),
                  weight: Math.max(1, Math.min(3, Number(row.weight ?? 1)))
                };
              })
              .filter((item): item is StoredTraitScoreDetails["question_scores"][number] => item !== null)
          : []
      };
    }
  } catch {
    // Ignore invalid JSON and fall back to empty details.
  }

  return {
    evidence: [],
    matched_positive_signals: [],
    matched_negative_signals: [],
    question_scores: []
  };
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
    ...(() => {
      const details = parseStoredTraitScoreDetails(item.evidenceJson);
      return {
        evidence: details.evidence,
        matched_positive_signals: details.matched_positive_signals,
        matched_negative_signals: details.matched_negative_signals
      };
    })(),
    traitId: item.traitId,
    traitName: item.trait.name,
    bucket: item.bucket,
    score0to5: item.score0to5,
    confidence: item.confidence,
    rationale: item.rationale
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
    (input.scorecard?.traitScores ?? []).map((trait) => {
      const details = parseStoredTraitScoreDetails(trait.evidenceJson);
      return [
        trait.traitId,
        {
          score_1_to_5: Number(Math.max(1, Math.min(5, trait.score0to5)).toFixed(2)),
          confidence: mapConfidence(trait.confidence),
          evidence: details.evidence,
          rationale: trait.rationale,
          answered: trait.traitQuestionId !== null || details.evidence.some((entry) => entry.length > 0)
        }
      ];
    })
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

const loadProgramTraits = async (programId: string, mode: "voice" | "chat" | "quiz") =>
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
              : {
                  where: { type: TraitQuestionType.CHAT },
                  orderBy: { createdAt: "asc" }
                }
        }
      }
    }
  });

const buildSessionInsights = async (input: {
  sessionId: string;
  programId: string;
  mode: "voice" | "chat" | "quiz";
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
  mode: "voice" | "chat" | "quiz";
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
              definition: item.trait.definition,
              rubricPositiveSignals: item.trait.rubricPositiveSignals,
              rubricNegativeSignals: item.trait.rubricNegativeSignals,
              questions: item.trait.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                type: question.type === TraitQuestionType.QUIZ ? "quiz" : "chat",
                optionsJson: question.optionsJson
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
            trait: {
              name: item.trait.name,
              definition: item.trait.definition,
              rubricPositiveSignals: item.trait.rubricPositiveSignals,
              rubricNegativeSignals: item.trait.rubricNegativeSignals,
              questions: item.trait.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                type: question.type === TraitQuestionType.QUIZ ? "quiz" : "chat",
                optionsJson: question.optionsJson
              }))
            }
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
            evidenceJson: JSON.stringify({
              evidence: item.evidence,
              matched_positive_signals: item.matchedPositiveSignals,
              matched_negative_signals: item.matchedNegativeSignals,
              question_scores: item.questionEvaluations
            }),
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

  if (!body.programId) {
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
    const asInterview = interviewCreateSchema.safeParse(req.body);
    const fromInterviewMount = req.baseUrl.includes("/api/interview/sessions");
    if (asInterview.success && (fromInterviewMount || asInterview.data.programFilterIds || asInterview.data.brandVoiceId)) {
      const session = await createInterviewSession({
        mode: asInterview.data.mode,
        candidateId: asInterview.data.candidateId,
        brandVoiceId: asInterview.data.brandVoiceId,
        language: asInterview.data.language,
        programFilterIds: asInterview.data.programFilterIds ?? (asInterview.data.programId ? [asInterview.data.programId] : undefined)
      });
      incrementMetric("sessions.created");
      res.status(201).json(session);
      return;
    }

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

sessionsRouter.post("/:id/turns", scoreRateLimit, async (req, res) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = interviewTurnSchema.parse(req.body);
    const result = await handleInterviewTurn({
      sessionId: id,
      mode: body.mode,
      text: body.text,
      language: body.language,
      traitId: body.traitId,
      questionId: body.questionId,
      askedTraitIds: body.askedTraitIds,
      askedQuestionIds: body.askedQuestionIds,
      preferredTraitIds: body.preferredTraitIds,
      programFilterIds: body.programFilterIds
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not process turn");
  }
});

sessionsRouter.post("/:id/checkpoint", scoreRateLimit, async (req, res) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = interviewCheckpointSchema.parse(req.body);
    const result = await handleCheckpointAction({
      sessionId: id,
      mode: body.mode,
      action: body.action,
      language: body.language,
      focusTraitIds: body.focusTraitIds,
      askedTraitIds: body.askedTraitIds,
      askedQuestionIds: body.askedQuestionIds,
      programFilterIds: body.programFilterIds
    });
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not process checkpoint");
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

    if (!session.programId || (session.mode !== "chat" && session.mode !== "quiz" && session.mode !== "voice")) {
      res.json(baseResponse);
      return;
    }

    const insights = await buildSessionInsights({
      sessionId: session.id,
      programId: session.programId,
      mode: session.mode as "voice" | "chat" | "quiz"
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

    if (!session.programId || (session.mode !== "chat" && session.mode !== "quiz" && session.mode !== "voice")) {
      res.json(baseResponse);
      return;
    }

    const insights = await buildSessionInsights({
      sessionId: session.id,
      programId: session.programId,
      mode: session.mode as "voice" | "chat" | "quiz"
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

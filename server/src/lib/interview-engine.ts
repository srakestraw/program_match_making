import { ProgramTraitPriorityBucket, TraitQuestionType } from "@prisma/client";
import {
  computeTraitImpacts,
  pickNextTrait,
  rankProgramsByTraits,
  shouldTriggerCheckpoint,
  type ProgramMatchInput,
  type TraitState
} from "@pmm/domain";
import { prisma } from "./prisma.js";
import { evaluateTraitQuestionResponse, splitRubricSignals } from "./trait-scoring.js";
import { buildInterviewSystemPrompt, DEFAULT_INTERVIEW_LANGUAGE } from "./interview-language.js";

const bucketWeight: Record<ProgramTraitPriorityBucket, number> = {
  CRITICAL: 1,
  VERY_IMPORTANT: 0.8,
  IMPORTANT: 0.6,
  NICE_TO_HAVE: 0.4
};

type Mode = "voice" | "chat" | "quiz";

type Question = {
  id: string;
  traitId: string;
  traitName: string;
  prompt: string;
  type: "chat" | "quiz";
  options: string[];
};

type ProgramContext = {
  programs: ProgramMatchInput[];
  traitMeta: Map<
    string,
    {
      traitName: string;
      category: string | null;
      questions: Question[];
      positiveSignals: string[];
      negativeSignals: string[];
      definition: string | null;
    }
  >;
};

const parseOptions = (optionsJson: string | null): string[] => {
  if (!optionsJson) return [];
  try {
    const parsed = JSON.parse(optionsJson);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
};

const confidenceLabel = (value: number): "low" | "medium" | "high" => {
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "medium";
  return "low";
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const loadProgramContext = async (input: { mode: Mode; programFilterIds?: string[] }): Promise<ProgramContext> => {
  const scopedPrograms = await prisma.program.findMany({
    where: input.programFilterIds?.length ? { id: { in: input.programFilterIds } } : undefined,
    include: {
      traits: {
        include: {
          trait: {
            include: {
              questions: {
                where: {
                  type: input.mode === "quiz" ? TraitQuestionType.QUIZ : TraitQuestionType.CHAT
                },
                orderBy: { createdAt: "asc" }
              }
            }
          }
        }
      }
    },
    orderBy: { name: "asc" },
    take: 24
  });

  const programs = scopedPrograms.map((program) => ({
    programId: program.id,
    programName: program.name,
    traits: program.traits.map((item) => ({
      traitId: item.traitId,
      weight: bucketWeight[item.bucket]
    }))
  }));

  const traitMeta = new Map<string, ProgramContext["traitMeta"] extends Map<string, infer T> ? T : never>();
  for (const program of scopedPrograms) {
    for (const item of program.traits) {
      if (traitMeta.has(item.traitId)) continue;
      traitMeta.set(item.traitId, {
        traitName: item.trait.name,
        category: item.trait.category,
        questions: item.trait.questions.map((question) => ({
          id: question.id,
          traitId: question.traitId,
          traitName: item.trait.name,
          prompt: question.prompt,
          type: question.type === TraitQuestionType.QUIZ ? "quiz" : "chat",
          options: parseOptions(question.optionsJson)
        })),
        positiveSignals: splitRubricSignals(item.trait.rubricPositiveSignals),
        negativeSignals: splitRubricSignals(item.trait.rubricNegativeSignals),
        definition: item.trait.definition
      });
    }
  }

  return { programs, traitMeta };
};

const buildSnapshot = (input: {
  traitMeta: ProgramContext["traitMeta"];
  traitStates: TraitState[];
  activeTraitId: string | null;
}) => {
  const stateByTraitId = new Map(input.traitStates.map((item) => [item.traitId, item]));
  const orderedTraits = [...input.traitMeta.entries()].sort((a, b) => a[1].traitName.localeCompare(b[1].traitName));
  return {
    traits: orderedTraits.map(([traitId, meta]) => {
      const state = stateByTraitId.get(traitId);
      return {
        traitId,
        traitName: meta.traitName,
        score_1_to_5: state?.score0to5 ?? null,
        confidence: state ? confidenceLabel(state.confidence0to1) : null,
        evidence: [],
        rationale: null,
        status: input.activeTraitId === traitId ? "active" : state ? "complete" : "unanswered"
      };
    })
  };
};

const buildProgramFit = (input: {
  programs: ProgramMatchInput[];
  traitStates: TraitState[];
  previousScores?: Record<string, number>;
}) => {
  const ranked = rankProgramsByTraits({
    programs: input.programs,
    traits: input.traitStates,
    previousScores: input.previousScores,
    limit: 5
  });

  return {
    programs: ranked.programs.map((item) => ({
      programId: item.programId,
      programName: item.programName,
      fitScore_0_to_100: item.fitScore_0_to_100,
      confidence_0_to_1: item.confidence_0_to_1,
      deltaFromLast_0_to_100: item.deltaFromLast_0_to_100,
      explainability: item.explainability,
      topTraits: item.explainability.topContributors.map((trait) => ({
        traitName: trait.traitName,
        delta: Number((trait.contribution * 100).toFixed(2))
      }))
    })),
    selectedProgramId: null
  };
};

const chooseQuestion = (input: {
  mode: Mode;
  traitMeta: ProgramContext["traitMeta"];
  traitStates: TraitState[];
  programs: ProgramMatchInput[];
  recentTraitIds?: string[];
  askedQuestionIds?: string[];
  preferredTraitIds?: string[];
}) => {
  const askedQuestionIds = new Set(input.askedQuestionIds ?? []);
  const traitImpacts = computeTraitImpacts({
    programs: input.programs,
    maxPrograms: 5
  });
  const allTraits = [...input.traitMeta.entries()].map(([traitId, meta]) => ({
    traitId,
    category: meta.category as any
  }));

  const preferred = input.preferredTraitIds ?? [];
  const prioritizedTraitIds = preferred.length > 0 ? preferred : allTraits.map((item) => item.traitId);

  const selectedTraits = allTraits.filter((item) => prioritizedTraitIds.includes(item.traitId));
  const picked = pickNextTrait({
    traits: selectedTraits.length > 0 ? selectedTraits : allTraits,
    traitStates: input.traitStates,
    traitImpacts,
    recentTraitIds: input.recentTraitIds
  });

  const candidateTraitIds = [picked.traitId, ...picked.scores.map((item) => item.traitId)].filter(
    (value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index
  );

  const firstQuestionForTrait = (traitId: string) => {
    const meta = input.traitMeta.get(traitId);
    if (!meta) return null;
    const available = meta.questions.filter((question) => !askedQuestionIds.has(question.id));
    return available[0] ?? meta.questions[0] ?? null;
  };

  const nextQuestion = candidateTraitIds.map((traitId) => firstQuestionForTrait(traitId)).find((item) => item !== null) ?? null;
  const prefetchedQuestions = candidateTraitIds
    .slice(1)
    .map((traitId) => firstQuestionForTrait(traitId))
    .filter((item): item is Question => Boolean(item))
    .slice(0, 2);

  return {
    nextQuestion,
    prefetchedQuestions
  };
};

const parseEvidence = (value: string) => {
  try {
    const parsed = JSON.parse(value) as { evidence?: string[] };
    return Array.isArray(parsed?.evidence) ? parsed.evidence.map((item) => String(item)) : [];
  } catch {
    return [];
  }
};

const loadTraitStates = async (sessionId: string, traitMeta: ProgramContext["traitMeta"]) => {
  let rows:
    | Array<{
        traitId: string;
        score0to5: number;
        confidence0to1: number;
        evidenceJson: string;
        rationale: string | null;
      }>
    | null = null;

  try {
    rows = await prisma.candidateTraitScore.findMany({
      where: { sessionId },
      select: {
        traitId: true,
        score0to5: true,
        confidence0to1: true,
        evidenceJson: true,
        rationale: true
      }
    });
  } catch (error) {
    // Allow startup against a database that has not applied the latest migration yet.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2021"
    ) {
      rows = [];
    } else {
      throw error;
    }
  }

  return (rows ?? []).map((row) => ({
    traitId: row.traitId,
    traitName: traitMeta.get(row.traitId)?.traitName ?? row.traitId,
    category: (traitMeta.get(row.traitId)?.category as any) ?? null,
    score0to5: row.score0to5,
    confidence0to1: row.confidence0to1,
    evidence: parseEvidence(row.evidenceJson),
    rationale: row.rationale
  }));
};

export const createInterviewSession = async (input: {
  mode: Mode;
  candidateId?: string;
  brandVoiceId?: string;
  programFilterIds?: string[];
  language?: string;
}) => {
  const language = (input.language ?? DEFAULT_INTERVIEW_LANGUAGE).trim().toLowerCase();
  const session = await prisma.candidateSession.create({
    data: {
      mode: input.mode,
      channel: input.mode === "voice" ? "WEB_VOICE" : input.mode === "chat" ? "WEB_CHAT" : "WEB_QUIZ",
      status: "active",
      sessionLanguageTag: language,
      candidateId: input.candidateId
    }
  });

  const [brandVoice, context] = await Promise.all([
    input.brandVoiceId
      ? prisma.brandVoice.findUnique({ where: { id: input.brandVoiceId } })
      : prisma.brandVoice.findFirst({
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
        }),
    loadProgramContext({ mode: input.mode, programFilterIds: input.programFilterIds })
  ]);

  const traitStates = await loadTraitStates(session.id, context.traitMeta);
  const nextQuestionSet = chooseQuestion({
    mode: input.mode,
    traitMeta: context.traitMeta,
    traitStates,
    programs: context.programs
  });
  const snapshot = buildSnapshot({
    traitMeta: context.traitMeta,
    traitStates,
    activeTraitId: nextQuestionSet.nextQuestion?.traitId ?? null
  });
  const programFit = buildProgramFit({
    programs: context.programs,
    traitStates
  });

  const initialPrompt = brandVoice
    ? `Welcome! I am your ${brandVoice.primaryTone} admissions interviewer. Let's explore your fit step by step.`
    : "Welcome! I am your admissions interviewer. Let's explore your strengths and goals.";
  const systemPrompt = buildInterviewSystemPrompt({
    brandVoicePrompt: brandVoice
      ? `Use a ${brandVoice.primaryTone} tone with these style flags: ${brandVoice.styleFlags.join(", ") || "clear and supportive"}.`
      : null,
    language
  });

  return {
    sessionId: session.id,
    brandVoiceId: brandVoice?.id ?? null,
    realtimeVoiceName: brandVoice?.ttsVoiceName ?? "alloy",
    language,
    languageTag: language,
    systemPrompt,
    initialPrompt,
    scoring_snapshot: snapshot,
    program_fit: programFit,
    nextQuestion: nextQuestionSet.nextQuestion,
    prefetchedQuestions: nextQuestionSet.prefetchedQuestions,
    answeredTraitCount: 0,
    checkpoint: null
  };
};

export const scoreTraitFromTurn = (input: {
  answer: string;
  traitId: string;
  questionId?: string;
  mode: Mode;
  traitMeta: ProgramContext["traitMeta"];
  existingState?: { score0to5: number; confidence0to1: number; evidence: string[]; rationale: string | null } | null;
}) => {
  const meta = input.traitMeta.get(input.traitId);
  if (!meta) return null;
  const question = meta.questions.find((item) => item.id === input.questionId) ?? meta.questions[0];
  if (!question) return null;

  const evaluation = evaluateTraitQuestionResponse({
    trait: {
      traitId: input.traitId,
      traitName: meta.traitName,
      traitDefinition: meta.definition,
      positiveSignals: meta.positiveSignals,
      negativeSignals: meta.negativeSignals
    },
    question: {
      questionId: question.id,
      questionPrompt: question.prompt,
      questionType: input.mode === "quiz" ? "quiz" : "chat",
      optionLabels: question.options
    },
    answer: input.answer
  });

  const previous = input.existingState;
  const blendedScore = previous ? previous.score0to5 * 0.55 + evaluation.score0to5 * 0.45 : evaluation.score0to5;
  const blendedConfidence = previous
    ? clamp(previous.confidence0to1 + (1 - previous.confidence0to1) * evaluation.confidence * 0.35, 0, 1)
    : clamp(0.35 + evaluation.confidence * 0.6, 0, 1);
  const evidence = [...(previous?.evidence ?? []), ...evaluation.evidence].filter((item) => item.length > 0).slice(-6);

  return {
    score0to5: Number(clamp(blendedScore, 0, 5).toFixed(2)),
    confidence0to1: Number(clamp(blendedConfidence, 0, 1).toFixed(2)),
    evidence,
    rationale: evaluation.rationale
  };
};

export const handleInterviewTurn = async (input: {
  sessionId: string;
  mode: Mode;
  text: string;
  language?: string;
  traitId?: string;
  questionId?: string;
  askedTraitIds?: string[];
  askedQuestionIds?: string[];
  programFilterIds?: string[];
  preferredTraitIds?: string[];
}) => {
  const effectiveLanguage = (input.language ?? DEFAULT_INTERVIEW_LANGUAGE).trim().toLowerCase();
  if (input.language) {
    await prisma.candidateSession.update({
      where: { id: input.sessionId },
      data: { sessionLanguageTag: effectiveLanguage }
    });
  }
  const context = await loadProgramContext({ mode: input.mode, programFilterIds: input.programFilterIds });
  const previousTraitStates = await loadTraitStates(input.sessionId, context.traitMeta);
  const previousProgramFit = buildProgramFit({
    programs: context.programs,
    traitStates: previousTraitStates
  });
  const previousScoreMap = Object.fromEntries(previousProgramFit.programs.map((item) => [item.programId, item.fitScore_0_to_100]));

  await prisma.transcriptTurn.create({
    data: {
      sessionId: input.sessionId,
      speaker: "candidate",
      text: input.text,
      ts: new Date()
    }
  });

  if (input.traitId) {
    const existing = previousTraitStates.find((item) => item.traitId === input.traitId);
    const nextState = scoreTraitFromTurn({
      answer: input.text,
      traitId: input.traitId,
      questionId: input.questionId,
      mode: input.mode,
      traitMeta: context.traitMeta,
      existingState: existing
        ? {
            score0to5: existing.score0to5 ?? 2.5,
            confidence0to1: existing.confidence0to1,
            evidence: existing.evidence,
            rationale: existing.rationale
          }
        : null
    });

    if (nextState) {
      await prisma.candidateTraitScore.upsert({
        where: {
          sessionId_traitId: {
            sessionId: input.sessionId,
            traitId: input.traitId
          }
        },
        update: {
          score0to5: nextState.score0to5,
          confidence0to1: nextState.confidence0to1,
          evidenceJson: JSON.stringify({ evidence: nextState.evidence }),
          rationale: nextState.rationale
        },
        create: {
          sessionId: input.sessionId,
          traitId: input.traitId,
          score0to5: nextState.score0to5,
          confidence0to1: nextState.confidence0to1,
          evidenceJson: JSON.stringify({ evidence: nextState.evidence }),
          rationale: nextState.rationale
        }
      });
    }
  }

  const traitStates = await loadTraitStates(input.sessionId, context.traitMeta);
  const nextQuestionSet = chooseQuestion({
    mode: input.mode,
    traitMeta: context.traitMeta,
    traitStates,
    programs: context.programs,
    recentTraitIds: input.askedTraitIds,
    askedQuestionIds: input.askedQuestionIds,
    preferredTraitIds: input.preferredTraitIds
  });

  const scoringSnapshot = buildSnapshot({
    traitMeta: context.traitMeta,
    traitStates,
    activeTraitId: nextQuestionSet.nextQuestion?.traitId ?? null
  });
  const programFit = buildProgramFit({
    programs: context.programs,
    traitStates,
    previousScores: previousScoreMap
  });
  const answeredTraitCount = await prisma.transcriptTurn.count({
    where: { sessionId: input.sessionId, speaker: "candidate" }
  });
  const checkpoint = shouldTriggerCheckpoint(answeredTraitCount)
    ? {
        required: true,
        answeredTraitCount,
        prompt: "Are you satisfied with these matches or keep going to improve confidence?",
        suggestedTraitIds: programFit.programs[0]?.explainability.gaps.map((item) => item.traitId).slice(0, 2) ?? []
      }
    : null;

  return {
    languageTag: effectiveLanguage,
    scoring_snapshot: scoringSnapshot,
    program_fit: programFit,
    nextQuestion: nextQuestionSet.nextQuestion,
    prefetchedQuestions: nextQuestionSet.prefetchedQuestions,
    answeredTraitCount,
    checkpoint
  };
};

export const handleCheckpointAction = async (input: {
  sessionId: string;
  mode: Mode;
  action: "stop" | "continue" | "focus";
  language?: string;
  focusTraitIds?: string[];
  askedTraitIds?: string[];
  askedQuestionIds?: string[];
  programFilterIds?: string[];
}) => {
  const effectiveLanguage = (input.language ?? DEFAULT_INTERVIEW_LANGUAGE).trim().toLowerCase();
  if (input.language) {
    await prisma.candidateSession.update({
      where: { id: input.sessionId },
      data: { sessionLanguageTag: effectiveLanguage }
    });
  }
  if (input.action === "stop") {
    await prisma.candidateSession.update({
      where: { id: input.sessionId },
      data: { status: "completed", endedAt: new Date() }
    });
  }

  const context = await loadProgramContext({ mode: input.mode, programFilterIds: input.programFilterIds });
  const traitStates = await loadTraitStates(input.sessionId, context.traitMeta);
  const nextQuestionSet = chooseQuestion({
    mode: input.mode,
    traitMeta: context.traitMeta,
    traitStates,
    programs: context.programs,
    recentTraitIds: input.askedTraitIds,
    askedQuestionIds: input.askedQuestionIds,
    preferredTraitIds: input.action === "focus" ? input.focusTraitIds : undefined
  });

  return {
    languageTag: effectiveLanguage,
    nextQuestion: input.action === "stop" ? null : nextQuestionSet.nextQuestion,
    scoring_snapshot: buildSnapshot({
      traitMeta: context.traitMeta,
      traitStates,
      activeTraitId: nextQuestionSet.nextQuestion?.traitId ?? null
    }),
    program_fit: buildProgramFit({
      programs: context.programs,
      traitStates
    })
  };
};

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
import { filterActivePrograms } from "./program-activity.js";
import { evaluateTraitQuestionResponse, splitRubricSignals } from "./trait-scoring.js";
import { buildInterviewSystemPrompt, DEFAULT_INTERVIEW_LANGUAGE } from "./interview-language.js";
import { createLangfuseTrace, endLangfuseSpan, startLangfuseSpan } from "./langfuse.js";
import { log } from "./logger.js";

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
  publicLabel: string;
  oneLineHook: string | null;
  archetypeTag: string | null;
  displayIcon: string | null;
  visualMood: string | null;
  narrativeIntro: string | null;
  answerStyle: "RADIO" | "CARD_GRID" | "SLIDER" | "CHAT" | null;
  answerOptionsMeta: Array<{ label: string; microCopy?: string; iconToken?: string; traitScore?: number }>;
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
      publicLabel: string;
      category: string | null;
      questions: Question[];
      positiveSignals: string[];
      negativeSignals: string[];
      definition: string | null;
    }
  >;
};

type RotationDiagnostics = {
  recentTraitWindow: string[];
  askedQuestionCount: number;
  usedPreferredTraits: boolean;
  preferredTraitCount: number;
  selectedTraitId: string | null;
  selectedQuestionId: string | null;
  selectedTraitRecentCount: number;
  selectedTraitConsecutiveCount: number;
  topCandidateTraits: Array<{ traitId: string; priority: number }>;
};

const countConsecutiveFromEnd = (values: string[], target: string | null) => {
  if (!target) return 0;
  let count = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== target) break;
    count += 1;
  }
  return count;
};

const logRotationTelemetry = (input: {
  event: "session_create" | "turn" | "checkpoint";
  sessionId: string;
  mode: Mode;
  diagnostics: RotationDiagnostics;
  durationMs?: number;
  answeredTraitCount?: number;
  checkpointRequired?: boolean;
  action?: "stop" | "continue" | "focus" | "deepen";
}) => {
  log("info", "interview.rotation.diagnostics", {
    event: input.event,
    mode: input.mode,
    sessionId: input.sessionId,
    durationMs: input.durationMs,
    answeredTraitCount: input.answeredTraitCount,
    checkpointRequired: input.checkpointRequired,
    action: input.action,
    ...input.diagnostics
  });

  if (input.diagnostics.selectedTraitConsecutiveCount >= 2) {
    log("warn", "interview.rotation.streak_detected", {
      event: input.event,
      mode: input.mode,
      sessionId: input.sessionId,
      selectedTraitId: input.diagnostics.selectedTraitId,
      selectedTraitConsecutiveCount: input.diagnostics.selectedTraitConsecutiveCount,
      selectedTraitRecentCount: input.diagnostics.selectedTraitRecentCount
    });
  }
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

const parseOptionMeta = (raw: string | null): Array<{ label: string; microCopy?: string; iconToken?: string; traitScore?: number }> => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizePrompt = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const genericQuizPrompts = new Set([
  "how would you rate your current level in this area?",
  "how would you rate your current level in this area",
  "rate your current level in this area",
  "rate your level in this area"
]);

export const formatInterviewQuestionPrompt = (input: {
  prompt: string;
  questionType: "chat" | "quiz";
  publicLabel: string;
}) => {
  if (input.questionType !== "quiz") return input.prompt;
  if (!genericQuizPrompts.has(normalizePrompt(input.prompt))) return input.prompt;
  return `How would you rate your current level in ${input.publicLabel}?`;
};

const startsWithVowelSound = (value: string) => /^[aeiou]/i.test(value.trim());

const confidenceLabel = (value: number): "low" | "medium" | "high" => {
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "medium";
  return "low";
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your"
]);

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));

const unique = <T>(values: T[]) => values.filter((value, index) => values.indexOf(value) === index);

const extractInterestTokens = (text: string) => {
  const normalized = text.toLowerCase();
  const tokens = new Set(tokenize(text));
  const preferenceMatches = [
    ...normalized.matchAll(/\b(?:interested in|enjoy|love|like|prefer)\s+([a-z0-9\s-]{3,80})/gi),
    ...normalized.matchAll(/\b(?:skills?|strengths?)\s+(?:in|around|with)\s+([a-z0-9\s-]{3,80})/gi)
  ];
  for (const match of preferenceMatches) {
    const phrase = match[1] ?? "";
    for (const token of tokenize(phrase)) {
      tokens.add(token);
    }
  }
  return tokens;
};

const inferPreferredTraitIdsFromText = (input: {
  text: string;
  traitMeta: ProgramContext["traitMeta"];
  limit?: number;
}) => {
  const interestTokens = extractInterestTokens(input.text);
  if (interestTokens.size === 0) return [];

  const traitScores = [...input.traitMeta.entries()]
    .map(([traitId, meta]) => {
      const traitTokens = new Set(
        tokenize(
          [
            meta.traitName,
            meta.publicLabel,
            meta.category ?? "",
            meta.definition ?? "",
            ...meta.questions.map((question) => question.prompt)
          ]
            .filter(Boolean)
            .join(" ")
        )
      );
      const overlap = [...interestTokens].filter((token) => traitTokens.has(token)).length;
      return { traitId, overlap };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, input.limit ?? 4)
    .map((item) => item.traitId);

  return traitScores;
};

const buildInitialPrompt = (input: {
  mode: Mode;
  languageTag: string;
  brandVoice:
    | {
        name: string;
        primaryTone: string;
        toneModifiers: string[];
        styleFlags: string[];
      }
    | null;
}) => {
  if (!input.brandVoice) {
    return input.languageTag.startsWith("en")
      ? "Welcome. I am your admissions interviewer. Let's explore your fit one step at a time."
      : "Welcome. I am your admissions interviewer.";
  }

  const tone = input.brandVoice.primaryTone || "professional";
  const modifiers = input.brandVoice.toneModifiers.slice(0, 2).join(", ");
  const style = input.brandVoice.styleFlags.slice(0, 2).join(", ");
  const modifierLine = modifiers ? ` with ${startsWithVowelSound(modifiers) ? "an" : "a"} ${modifiers} style` : "";
  const styleLine = style ? ` Keep the conversation ${style}.` : "";

  return `Welcome. I am your ${tone} admissions interviewer${modifierLine}. I will ask short, supportive questions to understand your program fit.${styleLine}`;
};

const loadProgramContext = async (input: { mode: Mode; programFilterIds?: string[] }): Promise<ProgramContext> => {
  const scopedPrograms = await prisma.program.findMany({
    where: input.programFilterIds?.length ? { id: { in: input.programFilterIds } } : undefined,
    include: {
      traits: {
        include: {
          trait: {
            select: {
              id: true,
              name: true,
              publicLabel: true,
              oneLineHook: true,
              archetypeTag: true,
              displayIcon: true,
              visualMood: true,
              category: true,
              definition: true,
              rubricPositiveSignals: true,
              rubricNegativeSignals: true,
              questions: {
                  where: {
                    type: input.mode === "quiz" ? TraitQuestionType.QUIZ : TraitQuestionType.CHAT
                  },
                  select: {
                    id: true,
                    traitId: true,
                    prompt: true,
                    type: true,
                    optionsJson: true,
                    narrativeIntro: true,
                    answerStyle: true,
                    answerOptionsMetaJson: true
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

  const activePrograms = filterActivePrograms(scopedPrograms, {
    context: `interview-engine.loadProgramContext:${input.mode}`
  });

  const programs = activePrograms.map((program) => ({
    programId: program.id,
    programName: program.name,
    traits: program.traits.map((item) => ({
      traitId: item.traitId,
      weight: bucketWeight[item.bucket]
    }))
  }));

  const traitMeta = new Map<string, ProgramContext["traitMeta"] extends Map<string, infer T> ? T : never>();
  for (const program of activePrograms) {
    for (const item of program.traits) {
      if (traitMeta.has(item.traitId)) continue;
      traitMeta.set(item.traitId, {
        traitName: item.trait.name,
        publicLabel: item.trait.publicLabel ?? item.trait.name,
        category: item.trait.category,
        questions: item.trait.questions.map((question) => ({
          id: question.id,
          traitId: question.traitId,
          traitName: item.trait.name,
          publicLabel: item.trait.publicLabel ?? item.trait.name,
          oneLineHook: item.trait.oneLineHook ?? null,
          archetypeTag: item.trait.archetypeTag ?? null,
          displayIcon: item.trait.displayIcon ?? null,
          visualMood: item.trait.visualMood ?? null,
          narrativeIntro: question.narrativeIntro ?? null,
          answerStyle: (question.answerStyle as Question["answerStyle"]) ?? null,
          answerOptionsMeta: parseOptionMeta(question.answerOptionsMetaJson),
          prompt: formatInterviewQuestionPrompt({
            prompt: question.prompt,
            questionType: question.type === TraitQuestionType.QUIZ ? "quiz" : "chat",
            publicLabel: item.trait.publicLabel ?? item.trait.name
          }),
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
        publicLabel: meta.publicLabel,
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
  traitMeta: ProgramContext["traitMeta"];
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
      topTraits: item.explainability.topContributors.map((trait) => ({
        traitName: input.traitMeta?.get(trait.traitId)?.publicLabel ?? trait.traitName,
        publicLabel: input.traitMeta?.get(trait.traitId)?.publicLabel ?? trait.traitName,
        delta: Number((trait.contribution * 100).toFixed(2))
      })),
      explainability: {
        ...item.explainability,
        topContributors: item.explainability.topContributors.map((trait) => ({
          ...trait,
          traitName: input.traitMeta?.get(trait.traitId)?.publicLabel ?? trait.traitName,
          publicLabel: input.traitMeta?.get(trait.traitId)?.publicLabel ?? trait.traitName
        })),
        gaps: item.explainability.gaps.map((trait) => ({
          ...trait,
          traitName: input.traitMeta?.get(trait.traitId)?.publicLabel ?? trait.traitName
        })),
        suggestions: item.explainability.suggestions.map((trait) => ({
          ...trait,
          traitName: input.traitMeta?.get(trait.traitId)?.publicLabel ?? trait.traitName
        }))
      }
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
  const recentTraitWindow = (input.recentTraitIds ?? []).slice(-8);
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
  const selectedTraitId = nextQuestion?.traitId ?? candidateTraitIds[0] ?? null;
  const selectedTraitRecentCount = selectedTraitId ? recentTraitWindow.filter((item) => item === selectedTraitId).length : 0;
  const selectedTraitConsecutiveCount = countConsecutiveFromEnd(recentTraitWindow, selectedTraitId);

  return {
    nextQuestion,
    prefetchedQuestions,
    diagnostics: {
      recentTraitWindow,
      askedQuestionCount: askedQuestionIds.size,
      usedPreferredTraits: preferred.length > 0,
      preferredTraitCount: preferred.length,
      selectedTraitId,
      selectedQuestionId: nextQuestion?.id ?? null,
      selectedTraitRecentCount,
      selectedTraitConsecutiveCount,
      topCandidateTraits: picked.scores.slice(0, 3).map((item) => ({
        traitId: item.traitId,
        priority: Number(item.priority.toFixed(4))
      }))
    } satisfies RotationDiagnostics
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
  const startedAt = Date.now();
  const language = (input.language ?? DEFAULT_INTERVIEW_LANGUAGE).trim().toLowerCase();
  let span = null;
  let spanClosed = false;

  try {
    const session = await prisma.candidateSession.create({
      data: {
        mode: input.mode,
        channel: input.mode === "voice" ? "WEB_VOICE" : input.mode === "chat" ? "WEB_CHAT" : "WEB_QUIZ",
        status: "active",
        sessionLanguageTag: language,
        candidateId: input.candidateId
      }
    });

    createLangfuseTrace({
      traceId: session.id,
      name: "interview.session",
      sessionId: session.id,
      metadata: {
        mode: input.mode,
        language,
        hasProgramFilter: Boolean(input.programFilterIds?.length),
        hasBrandVoiceId: Boolean(input.brandVoiceId)
      }
    });
    span = startLangfuseSpan({
      traceId: session.id,
      name: "interview.session.create",
      input: {
        mode: input.mode,
        language,
        programFilterCount: input.programFilterIds?.length ?? 0
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
    logRotationTelemetry({
      event: "session_create",
      sessionId: session.id,
      mode: input.mode,
      durationMs: Date.now() - startedAt,
      diagnostics: nextQuestionSet.diagnostics
    });
    const snapshot = buildSnapshot({
      traitMeta: context.traitMeta,
      traitStates,
      activeTraitId: nextQuestionSet.nextQuestion?.traitId ?? null
    });
    const programFit = buildProgramFit({
      programs: context.programs,
      traitStates,
      traitMeta: context.traitMeta
    });

    const initialPrompt = buildInitialPrompt({
      mode: input.mode,
      languageTag: language,
      brandVoice: brandVoice
        ? {
            name: brandVoice.name,
            primaryTone: brandVoice.primaryTone,
            toneModifiers: brandVoice.toneModifiers,
            styleFlags: brandVoice.styleFlags
          }
        : null
    });
    const systemPrompt = buildInterviewSystemPrompt({
      brandVoicePrompt: brandVoice
        ? `Use a ${brandVoice.primaryTone} tone with these style flags: ${brandVoice.styleFlags.join(", ") || "clear and supportive"}.`
        : null,
      language
    });

    const result = {
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

    endLangfuseSpan(span, {
      output: {
        sessionId: session.id,
        nextQuestionId: result.nextQuestion?.id ?? null
      },
      metadata: {
        durationMs: Date.now() - startedAt
      }
    });
    spanClosed = true;

    return result;
  } catch (error) {
    endLangfuseSpan(span, {
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : "create interview session failed",
      metadata: {
        durationMs: Date.now() - startedAt
      }
    });
    spanClosed = true;
    throw error;
  } finally {
    if (!spanClosed) {
      endLangfuseSpan(span, {
        metadata: {
          durationMs: Date.now() - startedAt
        }
      });
    }
  }
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
  const startedAt = Date.now();
  const effectiveLanguage = (input.language ?? DEFAULT_INTERVIEW_LANGUAGE).trim().toLowerCase();
  const span = startLangfuseSpan({
    traceId: input.sessionId,
    name: "interview.turn",
    input: {
      mode: input.mode,
      language: effectiveLanguage,
      textLength: input.text.length,
      traitId: input.traitId ?? null,
      questionId: input.questionId ?? null
    }
  });
  let spanClosed = false;

  try {
    if (input.language) {
      await prisma.candidateSession.update({
        where: { id: input.sessionId },
        data: { sessionLanguageTag: effectiveLanguage }
      });
    }
    const context = await loadProgramContext({ mode: input.mode, programFilterIds: input.programFilterIds });
    const questionTraitId = input.questionId
      ? [...context.traitMeta.entries()].find(([, meta]) => meta.questions.some((question) => question.id === input.questionId))?.[0] ?? null
      : null;
    const effectiveTraitId = questionTraitId ?? input.traitId ?? null;
    const askedTraitIds = unique([...(input.askedTraitIds ?? []), ...(effectiveTraitId ? [effectiveTraitId] : [])]);
    const askedQuestionIds = unique([...(input.askedQuestionIds ?? []), ...(input.questionId ? [input.questionId] : [])]);

    if (input.traitId && questionTraitId && input.traitId !== questionTraitId) {
      log("warn", "interview.turn.trait_question_mismatch", {
        sessionId: input.sessionId,
        mode: input.mode,
        traitId: input.traitId,
        questionId: input.questionId,
        questionTraitId
      });
    }

    const previousTraitStates = await loadTraitStates(input.sessionId, context.traitMeta);
    const previousProgramFit = buildProgramFit({
      programs: context.programs,
      traitStates: previousTraitStates,
      traitMeta: context.traitMeta
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

    if (effectiveTraitId) {
      const existing = previousTraitStates.find((item) => item.traitId === effectiveTraitId);
      const nextState = scoreTraitFromTurn({
        answer: input.text,
        traitId: effectiveTraitId,
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
              traitId: effectiveTraitId
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
            traitId: effectiveTraitId,
            score0to5: nextState.score0to5,
            confidence0to1: nextState.confidence0to1,
            evidenceJson: JSON.stringify({ evidence: nextState.evidence }),
            rationale: nextState.rationale
          }
        });
      }
    }

    const traitStates = await loadTraitStates(input.sessionId, context.traitMeta);
    const inferredPreferredTraitIds = inferPreferredTraitIdsFromText({
      text: input.text,
      traitMeta: context.traitMeta,
      limit: 4
    });
    const prioritizedTraitIds = unique([...(input.preferredTraitIds ?? []), ...inferredPreferredTraitIds]).slice(0, 10);
    const nextQuestionSet = chooseQuestion({
      mode: input.mode,
      traitMeta: context.traitMeta,
      traitStates,
      programs: context.programs,
      recentTraitIds: askedTraitIds,
      askedQuestionIds,
      preferredTraitIds: prioritizedTraitIds.length > 0 ? prioritizedTraitIds : undefined
    });

    const scoringSnapshot = buildSnapshot({
      traitMeta: context.traitMeta,
      traitStates,
      activeTraitId: nextQuestionSet.nextQuestion?.traitId ?? null
    });
    const programFit = buildProgramFit({
      programs: context.programs,
      traitStates,
      previousScores: previousScoreMap,
      traitMeta: context.traitMeta
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
    logRotationTelemetry({
      event: "turn",
      sessionId: input.sessionId,
      mode: input.mode,
      durationMs: Date.now() - startedAt,
      answeredTraitCount,
      checkpointRequired: Boolean(checkpoint?.required),
      diagnostics: nextQuestionSet.diagnostics
    });
    if (inferredPreferredTraitIds.length > 0) {
      log("info", "interview.preferences.inferred", {
        sessionId: input.sessionId,
        mode: input.mode,
        inferredPreferredTraitIds
      });
    }

    const result = {
      languageTag: effectiveLanguage,
      scoring_snapshot: scoringSnapshot,
      program_fit: programFit,
      nextQuestion: nextQuestionSet.nextQuestion,
      prefetchedQuestions: nextQuestionSet.prefetchedQuestions,
      answeredTraitCount,
      checkpoint
    };

    endLangfuseSpan(span, {
      output: {
        answeredTraitCount,
        checkpointRequired: Boolean(checkpoint?.required),
        nextQuestionId: result.nextQuestion?.id ?? null,
        nextQuestionTraitId: result.nextQuestion?.traitId ?? null,
        effectiveTraitId,
        questionTraitId
      },
      metadata: {
        durationMs: Date.now() - startedAt,
        inferredPreferredTraitCount: inferredPreferredTraitIds.length,
        inferredPreferredTraitIds,
        traitQuestionMismatch:
          Boolean(input.traitId) && Boolean(questionTraitId) && input.traitId !== questionTraitId
      }
    });
    spanClosed = true;

    return result;
  } catch (error) {
    endLangfuseSpan(span, {
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : "interview turn failed",
      metadata: {
        durationMs: Date.now() - startedAt
      }
    });
    spanClosed = true;
    throw error;
  } finally {
    if (!spanClosed) {
      endLangfuseSpan(span, {
        metadata: {
          durationMs: Date.now() - startedAt
        }
      });
    }
  }
};

export const handleCheckpointAction = async (input: {
  sessionId: string;
  mode: Mode;
  action: "stop" | "continue" | "focus" | "deepen";
  language?: string;
  focusTraitIds?: string[];
  currentTraitId?: string;
  askedTraitIds?: string[];
  askedQuestionIds?: string[];
  programFilterIds?: string[];
}) => {
  const startedAt = Date.now();
  const effectiveLanguage = (input.language ?? DEFAULT_INTERVIEW_LANGUAGE).trim().toLowerCase();
  const span = startLangfuseSpan({
    traceId: input.sessionId,
    name: "interview.checkpoint",
    input: {
      mode: input.mode,
      action: input.action,
      language: effectiveLanguage,
      focusTraitCount: input.focusTraitIds?.length ?? 0
    }
  });
  let spanClosed = false;

  try {
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
    const fallbackCurrentTraitId = input.askedTraitIds?.[input.askedTraitIds.length - 1];
    const deepenTraitId = input.currentTraitId ?? fallbackCurrentTraitId;
    const nextQuestionSet = chooseQuestion({
      mode: input.mode,
      traitMeta: context.traitMeta,
      traitStates,
      programs: context.programs,
      recentTraitIds: input.askedTraitIds,
      askedQuestionIds: input.askedQuestionIds,
      preferredTraitIds:
        input.action === "focus"
          ? input.focusTraitIds
          : input.action === "deepen" && deepenTraitId
            ? [deepenTraitId]
            : undefined
    });
    logRotationTelemetry({
      event: "checkpoint",
      sessionId: input.sessionId,
      mode: input.mode,
      action: input.action,
      durationMs: Date.now() - startedAt,
      diagnostics: nextQuestionSet.diagnostics
    });

    const result = {
      languageTag: effectiveLanguage,
      nextQuestion: input.action === "stop" ? null : nextQuestionSet.nextQuestion,
      scoring_snapshot: buildSnapshot({
        traitMeta: context.traitMeta,
        traitStates,
        activeTraitId: nextQuestionSet.nextQuestion?.traitId ?? null
      }),
      program_fit: buildProgramFit({
        programs: context.programs,
        traitStates,
        traitMeta: context.traitMeta
      })
    };

    endLangfuseSpan(span, {
      output: {
        action: input.action,
        nextQuestionId: result.nextQuestion?.id ?? null
      },
      metadata: {
        durationMs: Date.now() - startedAt
      }
    });
    spanClosed = true;

    return result;
  } catch (error) {
    endLangfuseSpan(span, {
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : "checkpoint action failed",
      metadata: {
        durationMs: Date.now() - startedAt
      }
    });
    spanClosed = true;
    throw error;
  } finally {
    if (!spanClosed) {
      endLangfuseSpan(span, {
        metadata: {
          durationMs: Date.now() - startedAt
        }
      });
    }
  }
};

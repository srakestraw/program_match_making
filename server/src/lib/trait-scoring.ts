type TraitQuestionType = "chat" | "quiz";

export type TraitScoringContext = {
  traitId: string;
  traitName: string;
  traitDefinition: string | null;
  positiveSignals: string[];
  negativeSignals: string[];
};

export type TraitQuestionContext = {
  questionId: string;
  questionPrompt: string;
  questionType: TraitQuestionType;
  optionLabels?: string[];
};

export type TraitQuestionEvaluation = {
  questionId: string;
  questionPrompt: string;
  questionType: TraitQuestionType;
  score0to5: number;
  rationale: string;
  evidence: string[];
  matchedPositiveSignals: string[];
  matchedNegativeSignals: string[];
  confidence: number;
  weight: number;
};

export type TraitAggregateEvaluation = {
  score0to5: number;
  rationale: string;
  evidence: string[];
  matchedPositiveSignals: string[];
  matchedNegativeSignals: string[];
  confidence: number;
  questionEvaluations: TraitQuestionEvaluation[];
};

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "while",
  "about",
  "your",
  "their",
  "they",
  "them",
  "have",
  "has",
  "had",
  "were",
  "been",
  "also",
  "very",
  "over",
  "under",
  "more",
  "less",
  "than",
  "when",
  "what",
  "which"
]);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round2 = (value: number) => Number(value.toFixed(2));

const normalize = (value: string) => value.trim().toLowerCase();

const tokenize = (value: string) =>
  normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stopWords.has(token));

const dedupe = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];

const lineSplit = (value: string | null | undefined) =>
  dedupe(
    (value ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );

const signalMatchesAnswer = (signal: string, answer: string) => {
  const normalizedSignal = normalize(signal);
  const normalizedAnswer = normalize(answer);
  if (normalizedSignal.length === 0 || normalizedAnswer.length === 0) return false;

  if (normalizedAnswer.includes(normalizedSignal.slice(0, Math.min(normalizedSignal.length, 40)))) {
    return true;
  }

  const keywords = tokenize(signal);
  if (keywords.length === 0) return false;
  const matched = keywords.filter((keyword) => normalizedAnswer.includes(keyword));
  const coverage = matched.length / keywords.length;
  return matched.length >= 1 && coverage >= 0.4;
};

const extractEvidence = (answer: string, matchedSignals: string[]) => {
  const trimmed = answer.trim();
  if (trimmed.length === 0) return [];

  const candidates = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const signalKeywords = tokenize(matchedSignals.join(" "));

  const prioritized =
    signalKeywords.length === 0
      ? candidates
      : candidates.filter((sentence) => signalKeywords.some((keyword) => normalize(sentence).includes(keyword)));

  const source = prioritized.length > 0 ? prioritized : candidates;
  return source.slice(0, 3).map((item) => (item.length > 180 ? `${item.slice(0, 177)}...` : item));
};

export const splitRubricSignals = (value: string | null | undefined) => lineSplit(value);

export const evaluateTraitQuestionResponse = (input: {
  trait: TraitScoringContext;
  question: TraitQuestionContext;
  answer: string;
  weight?: number;
}): TraitQuestionEvaluation => {
  const answer = input.answer.trim();
  const matchedPositiveSignals = input.trait.positiveSignals.filter((signal) => signalMatchesAnswer(signal, answer));
  const matchedNegativeSignals = input.trait.negativeSignals.filter((signal) => signalMatchesAnswer(signal, answer));

  let score = 2.5 + matchedPositiveSignals.length * 0.8 - matchedNegativeSignals.length;
  if (answer.length > 120) score += 0.3;
  if (answer.length > 0 && answer.length < 30) score -= 0.3;

  const totalSignals = input.trait.positiveSignals.length + input.trait.negativeSignals.length;
  const matchedTotal = matchedPositiveSignals.length + matchedNegativeSignals.length;
  let confidence = 0.35 + (totalSignals > 0 ? (matchedTotal / totalSignals) * 0.45 : 0.1);
  if (answer.length > 120) confidence += 0.1;
  if (answer.length > 0 && answer.length < 30) confidence -= 0.1;

  if (answer.length === 0) {
    score = 1.8;
    confidence = 0.35;
  }

  const evidence = extractEvidence(answer, [...matchedPositiveSignals, ...matchedNegativeSignals]);
  const weight = input.weight ?? 1;

  return {
    questionId: input.question.questionId,
    questionPrompt: input.question.questionPrompt,
    questionType: input.question.questionType,
    score0to5: round2(clamp(score, 0, 5)),
    rationale:
      answer.length === 0
        ? "No answer provided for this question."
        : `Matched ${matchedPositiveSignals.length} positive and ${matchedNegativeSignals.length} negative rubric signals.`,
    evidence: evidence.length > 0 ? evidence : answer.length > 0 ? [answer.slice(0, 180)] : [],
    matchedPositiveSignals,
    matchedNegativeSignals,
    confidence: round2(clamp(confidence, 0.1, 0.95)),
    weight: clamp(weight, 1, 3)
  };
};

export const aggregateTraitQuestionEvaluations = (evaluations: TraitQuestionEvaluation[]): TraitAggregateEvaluation => {
  if (evaluations.length === 0) {
    return {
      score0to5: 2.5,
      rationale: "No responses were captured for this trait.",
      evidence: ["No response captured for this trait."],
      matchedPositiveSignals: [],
      matchedNegativeSignals: [],
      confidence: 0.35,
      questionEvaluations: []
    };
  }

  const totalWeight = evaluations.reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = evaluations.reduce((sum, item) => sum + item.score0to5 * item.weight, 0);
  const weightedConfidence = evaluations.reduce((sum, item) => sum + item.confidence * item.weight, 0);
  const matchedPositiveSignals = dedupe(evaluations.flatMap((item) => item.matchedPositiveSignals));
  const matchedNegativeSignals = dedupe(evaluations.flatMap((item) => item.matchedNegativeSignals));
  const evidence = dedupe(evaluations.flatMap((item) => item.evidence)).slice(0, 6);

  return {
    score0to5: round2(totalWeight > 0 ? weightedScore / totalWeight : 2.5),
    rationale: `Averaged ${evaluations.length} response${evaluations.length === 1 ? "" : "s"} across trait questions.`,
    evidence: evidence.length > 0 ? evidence : ["No response captured for this trait."],
    matchedPositiveSignals,
    matchedNegativeSignals,
    confidence: round2(totalWeight > 0 ? weightedConfidence / totalWeight : 0.35),
    questionEvaluations: evaluations
  };
};

export const buildTraitScoringPrompt = (input: {
  trait: TraitScoringContext;
  questions: TraitQuestionContext[];
  candidateTurns: Array<{ speaker: "candidate" | "assistant"; text: string }>;
  responsesByQuestionId?: Record<string, string>;
}) => {
  const lines: string[] = [];
  lines.push(`Trait Name: ${input.trait.traitName}`);
  lines.push(`Trait Definition: ${input.trait.traitDefinition?.trim() || "(none provided)"}`);
  lines.push(`Positive Signals:\n${input.trait.positiveSignals.map((item) => `- ${item}`).join("\n") || "- (none provided)"}`);
  lines.push(`Negative Signals:\n${input.trait.negativeSignals.map((item) => `- ${item}`).join("\n") || "- (none provided)"}`);
  lines.push("Questions:");
  for (const question of input.questions) {
    lines.push(`- ${question.questionId} [${question.questionType.toUpperCase()}] ${question.questionPrompt}`);
    if ((question.optionLabels ?? []).length > 0) {
      lines.push(`  Options: ${(question.optionLabels ?? []).join(" | ")}`);
    }
    const response = input.responsesByQuestionId?.[question.questionId];
    if (typeof response === "string" && response.trim().length > 0) {
      lines.push(`  Selected Answer: ${response.trim()}`);
    }
  }
  lines.push("Transcript:");
  for (const turn of input.candidateTurns) {
    lines.push(`- ${turn.speaker.toUpperCase()}: ${turn.text}`);
  }
  return lines.join("\n");
};

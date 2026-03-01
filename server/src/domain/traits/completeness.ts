import type { TraitCategory } from "@prisma/client";

export type TraitCompletenessCounts = {
  positiveSignals: number;
  negativeSignals: number;
  questions: number;
};

export type TraitCompleteness = {
  isComplete: boolean;
  percentComplete: number;
  missing: string[];
  counts: TraitCompletenessCounts;
};

export type TraitCompletenessInput = {
  name: string | null | undefined;
  category: TraitCategory | null | undefined;
  definition: string | null | undefined;
  rubricPositiveSignals: string | null | undefined;
  rubricNegativeSignals: string | null | undefined;
  questionsCount: number;
};

export const splitRubricLines = (value: string | null | undefined): string[] =>
  (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export const computeTraitCompleteness = (input: TraitCompletenessInput): TraitCompleteness => {
  const positiveSignals = splitRubricLines(input.rubricPositiveSignals);
  const negativeSignals = splitRubricLines(input.rubricNegativeSignals);
  const questions = Math.max(0, Number(input.questionsCount ?? 0));
  const nameOk = Boolean(input.name && input.name.trim().length > 0);
  const categoryOk = Boolean(input.category);
  const definitionOk = Boolean(input.definition && input.definition.trim().length > 0);
  const positiveOk = positiveSignals.length >= 3;
  const negativeOk = negativeSignals.length >= 2;
  const questionsOk = questions >= 1;

  const missing: string[] = [];
  if (!nameOk) missing.push("Name is required");
  if (!categoryOk) missing.push("Category is required");
  if (!definitionOk) missing.push("Definition is required");
  if (!positiveOk) missing.push("At least 3 positive signals are required");
  if (!negativeOk) missing.push("At least 2 negative signals are required");
  if (!questionsOk) missing.push("At least 1 question is required");

  const passed = [nameOk, categoryOk, definitionOk, positiveOk, negativeOk, questionsOk].filter(Boolean).length;
  const percentComplete = Math.round((passed / 6) * 100);

  return {
    isComplete: missing.length === 0,
    percentComplete,
    missing,
    counts: {
      positiveSignals: positiveSignals.length,
      negativeSignals: negativeSignals.length,
      questions
    }
  };
};

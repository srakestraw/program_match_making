import { describe, expect, it } from "vitest";
import {
  buildTraitScoringPrompt,
  evaluateTraitQuestionResponse,
  splitRubricSignals
} from "../src/lib/trait-scoring.js";

describe("trait scoring", () => {
  const trait = {
    traitId: "trait-1",
    traitName: "Analytical Thinking",
    traitDefinition: "Breaks down complex problems and makes reasoned decisions.",
    positiveSignals: splitRubricSignals(
      ["Provides concrete examples with data.", "Explains tradeoffs and decision rationale.", "Reflects on outcomes and lessons."].join(
        "\n"
      )
    ),
    negativeSignals: splitRubricSignals(
      ["Uses vague statements without evidence.", "Avoids accountability for outcomes.", "Cannot explain reasoning process."].join("\n")
    )
  };

  const question = {
    questionId: "q-1",
    questionPrompt: "Tell me about a difficult decision you made.",
    questionType: "chat" as const
  };

  it("scores a concrete response higher than a vague response", () => {
    const strong = evaluateTraitQuestionResponse({
      trait,
      question,
      answer:
        "I provided concrete examples with data, explained tradeoffs and decision rationale, and reflected on outcomes in our retention project."
    });
    const vague = evaluateTraitQuestionResponse({
      trait,
      question,
      answer: "I usually do my best and decide quickly."
    });

    expect(strong.matchedPositiveSignals.length).toBeGreaterThanOrEqual(2);
    expect(strong.matchedNegativeSignals.length).toBe(0);
    expect(strong.score0to5).toBeGreaterThan(vague.score0to5);
  });

  it("lowers score when negative signals are present", () => {
    const withNegative = evaluateTraitQuestionResponse({
      trait,
      question,
      answer: "Honestly I cannot explain my reasoning process and I usually give vague statements without evidence."
    });
    const withoutNegative = evaluateTraitQuestionResponse({
      trait,
      question,
      answer: "I explain tradeoffs and provide concrete examples from project outcomes."
    });

    expect(withNegative.matchedNegativeSignals.length).toBeGreaterThan(0);
    expect(withNegative.score0to5).toBeLessThan(withoutNegative.score0to5);
  });

  it("builds prompt context with trait definition and rubric signals", () => {
    const prompt = buildTraitScoringPrompt({
      trait,
      questions: [{ ...question, questionType: "quiz", optionLabels: ["Beginner", "Proficient"] }],
      candidateTurns: [{ speaker: "candidate", text: "I compared outcomes and explained my decision." }],
      responsesByQuestionId: { "q-1": "Proficient" }
    });

    expect(prompt).toContain("Trait Definition: Breaks down complex problems and makes reasoned decisions.");
    expect(prompt).toContain("Positive Signals:");
    expect(prompt).toContain("Negative Signals:");
    expect(prompt).toContain("Selected Answer: Proficient");
  });
});

import { describe, expect, it } from "vitest";
import { computeTraitCompleteness } from "../src/domain/traits/completeness.js";

describe("computeTraitCompleteness", () => {
  it("flags missing definition", () => {
    const result = computeTraitCompleteness({
      name: "Analytical Thinking",
      category: "ACADEMIC",
      definition: "",
      rubricPositiveSignals: "a\nb\nc",
      rubricNegativeSignals: "x\ny",
      questionsCount: 1
    });
    expect(result.isComplete).toBe(false);
    expect(result.missing).toContain("Definition is required");
  });

  it("flags missing signals", () => {
    const result = computeTraitCompleteness({
      name: "Analytical Thinking",
      category: "ACADEMIC",
      definition: "Defined",
      rubricPositiveSignals: "a\nb",
      rubricNegativeSignals: "x",
      questionsCount: 1
    });
    expect(result.isComplete).toBe(false);
    expect(result.missing).toContain("At least 3 positive signals are required");
    expect(result.missing).toContain("At least 2 negative signals are required");
  });

  it("flags missing questions", () => {
    const result = computeTraitCompleteness({
      name: "Analytical Thinking",
      category: "ACADEMIC",
      definition: "Defined",
      rubricPositiveSignals: "a\nb\nc",
      rubricNegativeSignals: "x\ny",
      questionsCount: 0
    });
    expect(result.isComplete).toBe(false);
    expect(result.missing).toContain("At least 1 question is required");
  });

  it("marks complete traits", () => {
    const result = computeTraitCompleteness({
      name: "Analytical Thinking",
      category: "ACADEMIC",
      definition: "Defined",
      rubricPositiveSignals: "a\nb\nc",
      rubricNegativeSignals: "x\ny",
      questionsCount: 2
    });
    expect(result.isComplete).toBe(true);
    expect(result.percentComplete).toBe(100);
    expect(result.missing).toHaveLength(0);
  });
});

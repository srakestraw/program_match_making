import { describe, expect, it } from "vitest";
import { formatInterviewQuestionPrompt } from "../src/lib/interview-engine.js";

describe("formatInterviewQuestionPrompt", () => {
  it("personalizes the generic seeded quiz prompt with the trait label", () => {
    expect(
      formatInterviewQuestionPrompt({
        prompt: "How would you rate your current level in this area?",
        questionType: "quiz",
        publicLabel: "Operations & Supply Chain Orientation"
      })
    ).toBe("How would you rate your current level in Operations & Supply Chain Orientation?");
  });

  it("preserves authored quiz prompts that are already specific", () => {
    expect(
      formatInterviewQuestionPrompt({
        prompt: "How do you prioritize tradeoffs in a supply chain disruption?",
        questionType: "quiz",
        publicLabel: "Operations & Supply Chain Orientation"
      })
    ).toBe("How do you prioritize tradeoffs in a supply chain disruption?");
  });

  it("does not rewrite chat prompts", () => {
    expect(
      formatInterviewQuestionPrompt({
        prompt: "Tell me about a time you improved process throughput.",
        questionType: "chat",
        publicLabel: "Operations & Supply Chain Orientation"
      })
    ).toBe("Tell me about a time you improved process throughput.");
  });
});

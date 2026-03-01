import { describe, expect, it } from "vitest";
import { buildInterviewSystemPrompt, ENGLISH_ONLY_GUARDRAIL } from "./interview-language.js";

describe("buildInterviewSystemPrompt", () => {
  it("appends english-only guardrail after brand voice prompt", () => {
    const prompt = buildInterviewSystemPrompt({
      brandVoicePrompt: "Brand voice: warm, direct, credible.",
      language: "en"
    });

    expect(prompt).toContain("Brand voice: warm, direct, credible.");
    expect(prompt).toContain("ask at most one brief follow-up for the same trait");
    expect(prompt).toContain(ENGLISH_ONLY_GUARDRAIL);
    expect(prompt.indexOf("Brand voice: warm, direct, credible.")).toBeLessThan(prompt.indexOf(ENGLISH_ONLY_GUARDRAIL));
  });
});

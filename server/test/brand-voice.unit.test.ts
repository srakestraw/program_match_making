import { describe, expect, it } from "vitest";
import {
  buildBrandVoicePrompt,
  createBrandVoiceSchema,
  normalizeToneProfile,
  updateBrandVoiceSchema
} from "../src/lib/brandVoice.js";

describe("brand voice schemas", () => {
  it("accepts v2 create payload", () => {
    const parsed = createBrandVoiceSchema.parse({
      name: "Enrollment Voice",
      primaryTone: "professional",
      toneModifiers: ["encouraging"],
      toneProfile: {
        formality: 75,
        warmth: 60,
        directness: 65,
        confidence: 70,
        energy: 55
      },
      styleFlags: ["clear"],
      avoidFlags: ["jargon_heavy"],
      canonicalExamples: []
    });

    expect(parsed.name).toBe("Enrollment Voice");
    expect(parsed.primaryTone).toBe("professional");
  });

  it("rejects empty updates", () => {
    expect(() => updateBrandVoiceSchema.parse({})).toThrow();
  });
});

describe("brand voice helpers", () => {
  it("normalizes invalid tone profiles to defaults", () => {
    expect(normalizeToneProfile({ random: true })).toEqual({
      formality: 75,
      warmth: 60,
      directness: 65,
      confidence: 70,
      energy: 55
    });
  });

  it("builds grounded prompt text", () => {
    const prompt = buildBrandVoicePrompt({
      name: "Brand Voice A",
      primaryTone: "professional",
      toneModifiers: ["encouraging"],
      toneProfile: {
        formality: 75,
        warmth: 60,
        directness: 65,
        confidence: 70,
        energy: 55
      },
      styleFlags: ["clear"],
      avoidFlags: ["jargon_heavy"],
      canonicalExamples: [{ id: "x", type: "headline", text: "Clarity that moves students.", pinned: true }],
      context: { useCase: "web", audience: "adult learners" }
    });

    expect(prompt).toContain("Primary tone: professional");
    expect(prompt).toContain("Canonical examples");
  });
});

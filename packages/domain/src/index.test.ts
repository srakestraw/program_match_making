import { describe, expect, it } from "vitest";
import { boardStateToProgramTraitRows, generateBrandVoicePreview, scoreCandidateSession } from "./index.js";

describe("boardStateToProgramTraitRows", () => {
  it("maps bucket board state to ordered rows with sortOrder per bucket", () => {
    const rows = boardStateToProgramTraitRows({
      CRITICAL: ["trait-a"],
      VERY_IMPORTANT: ["trait-c", "trait-b"],
      IMPORTANT: [],
      NICE_TO_HAVE: ["trait-d"]
    });

    expect(rows).toEqual([
      { traitId: "trait-a", bucket: "CRITICAL", sortOrder: 0 },
      { traitId: "trait-c", bucket: "VERY_IMPORTANT", sortOrder: 0 },
      { traitId: "trait-b", bucket: "VERY_IMPORTANT", sortOrder: 1 },
      { traitId: "trait-d", bucket: "NICE_TO_HAVE", sortOrder: 0 }
    ]);
  });
});

describe("scoreCandidateSession", () => {
  it("applies bucket weighting for overall score", () => {
    const result = scoreCandidateSession({
      perTraitRawScores: [
        { traitId: "critical", score: 5, bucket: "CRITICAL" },
        { traitId: "important", score: 1, bucket: "IMPORTANT" }
      ]
    });

    expect(result.overallScore).toBeCloseTo((5 * 1 + 1 * 0.5) / (1 + 0.5));
  });

  it("supports custom bucket weights", () => {
    const result = scoreCandidateSession({
      perTraitRawScores: [
        { traitId: "critical", score: 5, bucket: "CRITICAL" },
        { traitId: "important", score: 1, bucket: "IMPORTANT" }
      ],
      bucketWeights: {
        CRITICAL: 1,
        IMPORTANT: 1
      }
    });

    expect(result.overallScore).toBeCloseTo(3);
  });
});

describe("generateBrandVoicePreview", () => {
  it("is deterministic for the same input", () => {
    const input = {
      name: "Admissions Voice",
      primaryTone: "professional",
      toneModifiers: ["encouraging"],
      toneProfile: {
        formality: 80,
        warmth: 65,
        directness: 70,
        confidence: 75,
        energy: 55
      },
      styleFlags: ["clear", "credible"],
      avoidFlags: ["jargon_heavy"],
      seedText: "graduate outcomes"
    };

    expect(generateBrandVoicePreview(input)).toEqual(generateBrandVoicePreview(input));
  });

  it("maps profile bands into stable phrase choices", () => {
    const preview = generateBrandVoicePreview({
      name: "Student Success Voice",
      primaryTone: "friendly",
      toneModifiers: [],
      toneProfile: {
        formality: 20,
        warmth: 90,
        directness: 20,
        confidence: 20,
        energy: 80
      },
      styleFlags: ["supportive"],
      avoidFlags: ["overly_salesy"],
      seedText: "career readiness"
    });

    expect(preview.headline).toContain("smart way");
    expect(preview.cta).toContain("Learn more");
    expect(preview.email_intro).toContain("Supportive tone");
    expect(preview.description).toContain("Avoiding overly salesy");
  });
});

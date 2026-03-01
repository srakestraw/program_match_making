import { describe, expect, it } from "vitest";
import {
  boardStateToProgramTraitRows,
  computeProgramStatus,
  computeTraitImpacts,
  generateBrandVoicePreview,
  isProgramDraft,
  pickNextTrait,
  rankProgramsByTraits,
  scoreCandidateSession,
  shouldTriggerCheckpoint
} from "./index.js";

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

describe("rankProgramsByTraits", () => {
  it("ranks programs and includes confidence/explainability", () => {
    const result = rankProgramsByTraits({
      programs: [
        {
          programId: "p1",
          programName: "Program A",
          traits: [
            { traitId: "communication", weight: 0.6 },
            { traitId: "leadership", weight: 0.4 }
          ]
        },
        {
          programId: "p2",
          programName: "Program B",
          traits: [
            { traitId: "communication", weight: 0.2 },
            { traitId: "leadership", weight: 0.8 }
          ]
        }
      ],
      traits: [
        { traitId: "communication", traitName: "Communication", score0to5: 4.5, confidence0to1: 0.9 },
        { traitId: "leadership", traitName: "Leadership", score0to5: 2, confidence0to1: 0.5 }
      ]
    });

    expect(result.programs[0].programId).toBe("p1");
    expect(result.programs[0].confidence_0_to_1).toBeGreaterThan(0);
    expect(result.programs[0].explainability.topContributors.length).toBeGreaterThan(0);
  });
});

describe("pickNextTrait", () => {
  it("prefers high uncertainty * impact and avoids repeating category", () => {
    const impacts = computeTraitImpacts({
      programs: [
        {
          programId: "p1",
          programName: "A",
          traits: [
            { traitId: "t1", weight: 0.6 },
            { traitId: "t2", weight: 0.4 }
          ]
        },
        {
          programId: "p2",
          programName: "B",
          traits: [
            { traitId: "t1", weight: 0.1 },
            { traitId: "t2", weight: 0.9 }
          ]
        }
      ]
    });

    const next = pickNextTrait({
      traits: [
        { traitId: "t1", category: "ACADEMIC" },
        { traitId: "t2", category: "ACADEMIC" },
        { traitId: "t3", category: "MOTIVATION" }
      ],
      traitStates: [
        { traitId: "t1", traitName: "T1", score0to5: 4, confidence0to1: 0.9 },
        { traitId: "t2", traitName: "T2", score0to5: 3, confidence0to1: 0.2 },
        { traitId: "t3", traitName: "T3", score0to5: null, confidence0to1: 0.1 }
      ],
      traitImpacts: impacts,
      recentTraitIds: ["t1", "t2"]
    });

    expect(next.traitId).toBe("t3");
  });

  it("penalizes repeated trait streaks so interview rotates", () => {
    const next = pickNextTrait({
      traits: [
        { traitId: "t1", category: "ACADEMIC" },
        { traitId: "t2", category: "MOTIVATION" }
      ],
      traitStates: [
        { traitId: "t1", traitName: "T1", score0to5: 3.5, confidence0to1: 0.2 },
        { traitId: "t2", traitName: "T2", score0to5: null, confidence0to1: 0.35 }
      ],
      traitImpacts: {
        t1: 1,
        t2: 0.8
      },
      recentTraitIds: ["t1", "t1", "t1"]
    });

    expect(next.traitId).toBe("t2");
  });
});

describe("shouldTriggerCheckpoint", () => {
  it("triggers every 3 answered questions", () => {
    expect(shouldTriggerCheckpoint(1)).toBe(false);
    expect(shouldTriggerCheckpoint(3)).toBe(true);
    expect(shouldTriggerCheckpoint(6)).toBe(true);
  });
});

describe("computeProgramStatus", () => {
  it("returns DRAFT when degree level is missing", () => {
    expect(
      computeProgramStatus({
        degreeLevel: " ",
        department: "Business",
        isActive: true
      })
    ).toBe("DRAFT");
  });

  it("returns DRAFT when department is missing", () => {
    expect(
      computeProgramStatus({
        degreeLevel: "Masters",
        department: "",
        isActive: true
      })
    ).toBe("DRAFT");
  });

  it("returns ACTIVE for complete and active programs", () => {
    expect(
      computeProgramStatus({
        degreeLevel: "Masters",
        department: "Business",
        isActive: true
      })
    ).toBe("ACTIVE");
  });

  it("returns INACTIVE for complete and inactive programs", () => {
    expect(
      computeProgramStatus({
        degreeLevel: "Masters",
        department: "Business",
        isActive: false
      })
    ).toBe("INACTIVE");
  });

  it("matches isProgramDraft helper", () => {
    expect(isProgramDraft({ degreeLevel: null, department: "Business" })).toBe(true);
    expect(isProgramDraft({ degreeLevel: "Masters", department: "Business" })).toBe(false);
  });
});

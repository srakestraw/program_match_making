import { describe, expect, it } from "vitest";
import { computeProgramFitFromData } from "../src/lib/program-fit.js";

const programs = [
  {
    id: "program-a",
    name: "Program A",
    traits: [
      { traitId: "trait-1", bucket: "CRITICAL" as const, trait: { name: "Leadership" } },
      { traitId: "trait-2", bucket: "IMPORTANT" as const, trait: { name: "Communication" } }
    ]
  },
  {
    id: "program-b",
    name: "Program B",
    traits: [
      { traitId: "trait-1", bucket: "NICE_TO_HAVE" as const, trait: { name: "Leadership" } },
      { traitId: "trait-3", bucket: "VERY_IMPORTANT" as const, trait: { name: "Analytics" } }
    ]
  }
];

describe("computeProgramFitFromData", () => {
  it("uses neutral baseline for unanswered traits", () => {
    const fit = computeProgramFitFromData({
      programs,
      selectedProgramId: "program-a",
      snapshot: {
        traits: [
          {
            traitId: "trait-1",
            traitName: "Leadership",
            score_1_to_5: null,
            confidence: null,
            evidence: [],
            rationale: null,
            status: "unanswered"
          }
        ]
      },
      limit: 3
    });

    expect(fit.programs[0]?.fitScore_0_to_100).toBeGreaterThan(0);
    expect(fit.programs[0]?.fitScore_0_to_100).toBeLessThan(50);
  });

  it("applies bucket weights deterministically", () => {
    const baseline = computeProgramFitFromData({
      programs: [programs[0]!],
      selectedProgramId: "program-a",
      snapshot: {
        traits: [
          {
            traitId: "trait-1",
            traitName: "Leadership",
            score_1_to_5: 5,
            confidence: "high",
            evidence: ["Strong leadership examples"],
            rationale: "Consistent examples",
            status: "complete"
          },
          {
            traitId: "trait-2",
            traitName: "Communication",
            score_1_to_5: 1,
            confidence: "high",
            evidence: ["Weak communication examples"],
            rationale: "Needs improvement",
            status: "complete"
          }
        ]
      },
      limit: 3
    });

    const improved = computeProgramFitFromData({
      programs: [programs[0]!],
      selectedProgramId: "program-a",
      snapshot: {
        traits: [
          {
            traitId: "trait-1",
            traitName: "Leadership",
            score_1_to_5: 5,
            confidence: "high",
            evidence: ["Strong leadership examples"],
            rationale: "Consistent examples",
            status: "complete"
          },
          {
            traitId: "trait-2",
            traitName: "Communication",
            score_1_to_5: 5,
            confidence: "high",
            evidence: ["Strong communication examples"],
            rationale: "Strong communication",
            status: "complete"
          }
        ]
      },
      limit: 3
    });

    expect(improved.programs[0]!.fitScore_0_to_100).toBeGreaterThan(baseline.programs[0]!.fitScore_0_to_100);
  });

  it("applies confidence multipliers", () => {
    const high = computeProgramFitFromData({
      programs: [programs[0]!],
      selectedProgramId: "program-a",
      snapshot: {
        traits: [
          {
            traitId: "trait-1",
            traitName: "Leadership",
            score_1_to_5: 5,
            confidence: "high",
            evidence: ["Strong"],
            rationale: null,
            status: "complete"
          },
          {
            traitId: "trait-2",
            traitName: "Communication",
            score_1_to_5: 5,
            confidence: "high",
            evidence: ["Strong"],
            rationale: null,
            status: "complete"
          }
        ]
      },
      limit: 3
    });

    const low = computeProgramFitFromData({
      programs: [programs[0]!],
      selectedProgramId: "program-a",
      snapshot: {
        traits: [
          {
            traitId: "trait-1",
            traitName: "Leadership",
            score_1_to_5: 5,
            confidence: "low",
            evidence: ["Strong"],
            rationale: null,
            status: "complete"
          },
          {
            traitId: "trait-2",
            traitName: "Communication",
            score_1_to_5: 5,
            confidence: "low",
            evidence: ["Strong"],
            rationale: null,
            status: "complete"
          }
        ]
      },
      limit: 3
    });

    expect(high.programs[0]!.fitScore_0_to_100).toBeGreaterThan(low.programs[0]!.fitScore_0_to_100);
  });

  it("returns deterministic top traits by absolute contribution", () => {
    const fit = computeProgramFitFromData({
      programs: [programs[0]!],
      selectedProgramId: "program-a",
      snapshot: {
        traits: [
          {
            traitId: "trait-1",
            traitName: "Leadership",
            score_1_to_5: 5,
            confidence: "high",
            evidence: ["Strong"],
            rationale: null,
            status: "complete"
          },
          {
            traitId: "trait-2",
            traitName: "Communication",
            score_1_to_5: 1,
            confidence: "high",
            evidence: ["Weak"],
            rationale: null,
            status: "complete"
          }
        ]
      },
      limit: 3
    });

    expect(fit.programs[0]!.topTraits).toHaveLength(2);
    expect(fit.programs[0]!.topTraits[0]!.traitName).toBe("Leadership");
    expect(Math.abs(fit.programs[0]!.topTraits[0]!.delta)).toBeGreaterThanOrEqual(Math.abs(fit.programs[0]!.topTraits[1]!.delta));
  });
});

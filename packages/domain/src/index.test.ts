import { describe, expect, it } from "vitest";
import { boardStateToProgramTraitRows, scoreCandidateSession } from "./index.js";

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

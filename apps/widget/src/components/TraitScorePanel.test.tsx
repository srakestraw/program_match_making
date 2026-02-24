import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TraitScorePanel } from "./TraitScorePanel";

describe("TraitScorePanel", () => {
  it("updates trait state and confidence after scoring", () => {
    const { rerender } = render(
      <TraitScorePanel
        traits={[
          {
            traitId: "trait-1",
            traitName: "Communication",
            score_1_to_5: null,
            confidence: null,
            evidence: [],
            rationale: null,
            status: "unanswered"
          }
        ]}
      />
    );

    expect(screen.getByText("unanswered")).toBeInTheDocument();

    rerender(
      <TraitScorePanel
        traits={[
          {
            traitId: "trait-1",
            traitName: "Communication",
            score_1_to_5: 4,
            confidence: "high",
            evidence: ["Clear examples"],
            rationale: "Strong structured responses.",
            status: "complete"
          }
        ]}
      />
    );

    expect(screen.getByText("complete")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("Clear examples")).toBeInTheDocument();
  });
});

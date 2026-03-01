import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TraitScorePanel } from "./TraitScorePanel";
describe("TraitScorePanel", () => {
    it("updates trait state and confidence after scoring", () => {
        const { rerender } = render(_jsx(TraitScorePanel, { traits: [
                {
                    traitId: "trait-1",
                    traitName: "Communication",
                    score_1_to_5: null,
                    confidence: null,
                    evidence: [],
                    rationale: null,
                    status: "unanswered"
                }
            ] }));
        expect(screen.getByText("unanswered")).toBeInTheDocument();
        rerender(_jsx(TraitScorePanel, { traits: [
                {
                    traitId: "trait-1",
                    traitName: "Communication",
                    score_1_to_5: 4,
                    confidence: "high",
                    evidence: ["Clear examples"],
                    rationale: "Strong structured responses.",
                    status: "complete"
                }
            ] }));
        expect(screen.getByText("complete")).toBeInTheDocument();
        expect(screen.getByText("high")).toBeInTheDocument();
        expect(screen.getByText("Clear examples")).toBeInTheDocument();
    });
    it("shows continue and go deeper actions on active trait row", () => {
        const onActiveTraitAction = vi.fn();
        render(_jsx(TraitScorePanel, { traits: [
                {
                    traitId: "trait-1",
                    traitName: "Communication",
                    score_1_to_5: 3,
                    confidence: "medium",
                    evidence: [],
                    rationale: null,
                    status: "active"
                }
            ], activeTraitId: "trait-1", onActiveTraitAction: onActiveTraitAction }));
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));
        fireEvent.click(screen.getByRole("button", { name: "Go deeper" }));
        expect(onActiveTraitAction).toHaveBeenNthCalledWith(1, "continue");
        expect(onActiveTraitAction).toHaveBeenNthCalledWith(2, "deepen");
    });
});

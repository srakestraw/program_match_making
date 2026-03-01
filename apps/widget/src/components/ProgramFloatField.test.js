import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgramFloatField } from "./ProgramFloatField";
describe("ProgramFloatField", () => {
    it("renders confidence, narrative fit status, and explainability content", () => {
        render(_jsx(ProgramFloatField, { programs: [
                {
                    programId: "p1",
                    programName: "MS Data Science",
                    fitScore_0_to_100: 88,
                    confidence_0_to_1: 0.81,
                    deltaFromLast_0_to_100: 3.2,
                    topTraits: [{ traitName: "Communication", delta: 0.2 }],
                    explainability: {
                        topContributors: [{ traitId: "t1", traitName: "Communication", contribution: 0.3 }],
                        gaps: [{ traitId: "t2", traitName: "Leadership", reason: "low_confidence" }],
                        suggestions: [{ traitId: "t2", traitName: "Leadership", reason: "Ask for a leadership example." }]
                    }
                }
            ] }));
        expect(screen.getByText("High 81%")).toBeInTheDocument();
        expect(screen.getByText("High fit")).toBeInTheDocument();
        expect(screen.getByText("Trending upward")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Why this match?"));
        expect(screen.getByText("Top contributing traits")).toBeInTheDocument();
        expect(screen.getByText("Weak or missing traits")).toBeInTheDocument();
        expect(screen.getByText("What increases confidence")).toBeInTheDocument();
    });
});

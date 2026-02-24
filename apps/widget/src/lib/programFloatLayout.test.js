import { describe, expect, it } from "vitest";
import { computeProgramBubbleLayout } from "./programFloatLayout";
describe("computeProgramBubbleLayout", () => {
    it("moves bubble positions as fit scores change", () => {
        const before = computeProgramBubbleLayout({
            programs: [
                { programId: "a", programName: "A", fitScore_0_to_100: 35, topTraits: [] },
                { programId: "b", programName: "B", fitScore_0_to_100: 80, topTraits: [] }
            ],
            selectedProgramId: "a"
        });
        const after = computeProgramBubbleLayout({
            programs: [
                { programId: "a", programName: "A", fitScore_0_to_100: 85, topTraits: [] },
                { programId: "b", programName: "B", fitScore_0_to_100: 30, topTraits: [] }
            ],
            selectedProgramId: "a"
        });
        const beforeA = before.find((item) => item.programId === "a");
        const afterA = after.find((item) => item.programId === "a");
        expect(beforeA).toBeTruthy();
        expect(afterA).toBeTruthy();
        expect(afterA.xPct).not.toBe(beforeA.xPct);
        expect(afterA.yPct).not.toBe(beforeA.yPct);
        expect(afterA.sizePx).toBeGreaterThan(beforeA.sizePx);
    });
});

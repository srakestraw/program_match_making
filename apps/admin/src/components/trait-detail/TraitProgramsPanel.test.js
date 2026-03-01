import { jsx as _jsx } from "react/jsx-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraitProgramsPanel } from "./TraitProgramsPanel";
const samplePrograms = [
    { programId: "p1", programName: "Program One", bucket: "CRITICAL", weight: 1 },
    { programId: "p2", programName: "Program Two", bucket: "VERY_IMPORTANT", weight: 0.75 }
];
describe("TraitProgramsPanel", () => {
    afterEach(() => {
        cleanup();
    });
    it("renders title, count, and program list with bucket and weight", () => {
        render(_jsx(TraitProgramsPanel, { programs: samplePrograms, loading: false, error: null, onManage: () => { } }));
        expect(screen.getByText("Used In Programs")).toBeTruthy();
        expect(screen.getByText("2 programs")).toBeTruthy();
        expect(screen.getByText("Program One")).toBeTruthy();
        expect(screen.getByText("Program Two")).toBeTruthy();
        expect(screen.getByText("CRITICAL · 1.00")).toBeTruthy();
        expect(screen.getByText("VERY_IMPORTANT · 0.75")).toBeTruthy();
    });
    it("renders Manage button and calls onManage when clicked", async () => {
        const onManage = vi.fn();
        const user = userEvent.setup();
        render(_jsx(TraitProgramsPanel, { programs: samplePrograms, loading: false, error: null, onManage: onManage }));
        const manageButton = screen.getByRole("button", { name: "Manage associated programs" });
        await user.click(manageButton);
        expect(onManage).toHaveBeenCalledTimes(1);
    });
    it("shows loading state", () => {
        render(_jsx(TraitProgramsPanel, { programs: [], loading: true, error: null, onManage: () => { } }));
        expect(screen.getByText("Loading…")).toBeTruthy();
    });
    it("shows error state", () => {
        render(_jsx(TraitProgramsPanel, { programs: [], loading: false, error: "Failed to load", onManage: () => { } }));
        expect(screen.getByText("Failed to load")).toBeTruthy();
    });
    it("shows empty state when no programs", () => {
        render(_jsx(TraitProgramsPanel, { programs: [], loading: false, error: null, onManage: () => { } }));
        expect(screen.getByText("0 programs")).toBeTruthy();
        expect(screen.getByText("No associated programs yet.")).toBeTruthy();
    });
});

import { jsx as _jsx } from "react/jsx-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraitPickerModal } from "./TraitPickerModal";
const baseTraits = [
    {
        id: "trait-1",
        name: "Analytical Thinking",
        category: "ACADEMIC",
        definition: "Breaks problems into clear parts.",
        createdAt: "2026-02-01T00:00:00.000Z"
    },
    {
        id: "trait-2",
        name: "Data Storytelling",
        category: "ACADEMIC",
        definition: "Communicates data clearly.",
        createdAt: "2026-02-02T00:00:00.000Z"
    },
    {
        id: "trait-3",
        name: "Communication",
        category: "INTERPERSONAL",
        definition: "Conveys ideas effectively.",
        createdAt: "2026-02-03T00:00:00.000Z"
    }
];
function renderModal(overrides) {
    const onAddTraits = vi.fn(async () => { });
    const props = {
        isOpen: true,
        onClose: vi.fn(),
        traits: baseTraits,
        assignedTraitIds: new Set(),
        programId: "program-1",
        degreeLevel: "Masters",
        department: "Data Science",
        onAddTraits,
        ...overrides
    };
    render(_jsx(TraitPickerModal, { ...props }));
    return { onAddTraits, props };
}
describe("TraitPickerModal", () => {
    afterEach(() => {
        cleanup();
    });
    it("selects an individual trait into the Selected rail", async () => {
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByRole("button", { name: "Select Communication" }));
        const selectedRail = screen.getByLabelText("Selected traits");
        expect(selectedRail).toBeTruthy();
        expect(screen.getByRole("button", { name: "Remove Communication from selection" })).toBeTruthy();
    });
    it("selecting a set adds only traits that are not already added", async () => {
        const user = userEvent.setup();
        renderModal({ assignedTraitIds: new Set(["trait-1"]) });
        await user.click(screen.getByRole("button", { name: "Select set Analytics fundamentals" }));
        expect(screen.getByRole("button", { name: "Remove Data Storytelling from selection" })).toBeTruthy();
        expect(screen.queryByLabelText("Remove Analytical Thinking from selection")).toBeNull();
    });
    it("shows a notice when selecting a set that is fully unavailable", async () => {
        const user = userEvent.setup();
        renderModal({ assignedTraitIds: new Set(["trait-1", "trait-2"]) });
        await user.click(screen.getByRole("button", { name: "Select set Analytics fundamentals" }));
        expect(screen.getByText("All traits in this set are already added.")).toBeTruthy();
    });
    it("commitAdd sends selected trait ids and destination bucket", async () => {
        const user = userEvent.setup();
        const { onAddTraits } = renderModal();
        await user.click(screen.getByRole("button", { name: "Select Analytical Thinking" }));
        await user.click(screen.getByRole("button", { name: "Select Communication" }));
        await user.click(screen.getByRole("button", { name: "Add 2 traits" }));
        await waitFor(() => {
            expect(onAddTraits).toHaveBeenCalledTimes(1);
        });
        expect(onAddTraits).toHaveBeenCalledWith(["trait-1", "trait-3"], "IMPORTANT");
    });
    it("disables already-added traits and shows Added indicator", () => {
        renderModal({ assignedTraitIds: new Set(["trait-3"]) });
        const selectButton = screen.getByRole("button", { name: "Select Communication" });
        expect(selectButton.hasAttribute("disabled")).toBe(true);
        expect(screen.getByText("Added")).toBeTruthy();
        expect(screen.getByText("Already on board")).toBeTruthy();
    });
});

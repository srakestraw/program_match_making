import { jsx as _jsx } from "react/jsx-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
// @ts-expect-error Vitest resolves TSX source directly for this test.
import { TraitsPage } from "./main.tsx";
const createdAt = "2026-02-24T00:00:00.000Z";
const renderPage = () => render(_jsx(MemoryRouter, { children: _jsx(TraitsPage, {}) }));
describe("TraitsPage lifecycle UX", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });
    it("renders compact trait rows without verbose list badges", async () => {
        const fetchMock = vi.fn(async (input) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url.includes("/questions")) {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            if (url.includes("/api/admin/traits")) {
                return new Response(JSON.stringify({
                    data: [
                        {
                            id: "t1",
                            name: "Complete Trait",
                            category: "ACADEMIC",
                            status: "ACTIVE",
                            definition: "Defined",
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: "A\nB\nC",
                            rubricNegativeSignals: "X\nY",
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: true,
                                percentComplete: 100,
                                missing: [],
                                counts: { positiveSignals: 3, negativeSignals: 2, questions: 1 }
                            },
                            createdAt,
                            updatedAt: createdAt
                        },
                        {
                            id: "t2",
                            name: "Draft Trait",
                            category: "MOTIVATION",
                            status: "DRAFT",
                            definition: null,
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: null,
                            rubricNegativeSignals: null,
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: false,
                                percentComplete: 33,
                                missing: ["Definition is required", "At least 1 question is required"],
                                counts: { positiveSignals: 0, negativeSignals: 0, questions: 0 }
                            },
                            createdAt,
                            updatedAt: createdAt
                        }
                    ]
                }), { status: 200 });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Complete Trait");
        expect(screen.getByText("Active")).toBeTruthy();
        expect(screen.getByText("Draft")).toBeTruthy();
        expect(screen.queryByText("Ready")).toBeNull();
        expect(screen.queryByText("100% complete")).toBeNull();
    });
    it("applies selected row style and completeness bar ratio", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(async (input) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url.includes("/questions")) {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            if (url.includes("/api/admin/traits")) {
                return new Response(JSON.stringify({
                    data: [
                        {
                            id: "t1",
                            name: "Complete Trait",
                            category: "ACADEMIC",
                            status: "ACTIVE",
                            definition: "Defined",
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: "A\nB\nC",
                            rubricNegativeSignals: "X\nY",
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: true,
                                percentComplete: 100,
                                missing: [],
                                counts: { positiveSignals: 3, negativeSignals: 2, questions: 1 }
                            },
                            createdAt,
                            updatedAt: createdAt
                        },
                        {
                            id: "t2",
                            name: "Draft Trait",
                            category: "MOTIVATION",
                            status: "DRAFT",
                            definition: null,
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: null,
                            rubricNegativeSignals: null,
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: false,
                                percentComplete: 33,
                                missing: ["Definition is required", "At least 1 question is required"],
                                counts: { positiveSignals: 0, negativeSignals: 0, questions: 0 }
                            },
                            createdAt,
                            updatedAt: createdAt
                        }
                    ]
                }), { status: 200 });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Complete Trait");
        const completeRow = screen.getAllByTestId("trait-row-t1")[0];
        const draftRow = screen.getAllByTestId("trait-row-t2")[0];
        await user.click(draftRow);
        expect(completeRow.getAttribute("aria-current")).toBeNull();
        expect(draftRow.getAttribute("aria-current")).toBe("true");
    });
    it("blocks activation with checklist when server returns TRAIT_INCOMPLETE", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(async (input, init) => {
            const url = typeof input === "string" ? input : input.toString();
            const method = init?.method ?? "GET";
            if (url.includes("/api/admin/traits?") && method === "GET") {
                return new Response(JSON.stringify({
                    data: [
                        {
                            id: "t1",
                            name: "Incomplete Trait",
                            category: "ACADEMIC",
                            status: "DRAFT",
                            definition: null,
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: null,
                            rubricNegativeSignals: null,
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: false,
                                percentComplete: 33,
                                missing: ["Definition is required", "At least 1 question is required"],
                                counts: { positiveSignals: 0, negativeSignals: 0, questions: 0 }
                            },
                            createdAt,
                            updatedAt: createdAt
                        }
                    ]
                }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1/questions")) {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1") && method === "PUT") {
                return new Response(JSON.stringify({
                    error: {
                        code: "TRAIT_INCOMPLETE",
                        message: "Trait incomplete",
                        missing: ["Definition is required", "At least 1 question is required"]
                    }
                }), { status: 400 });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Incomplete Trait");
        await user.click(screen.getByText("Incomplete Trait"));
        await user.selectOptions(screen.getByLabelText("Status"), "ACTIVE");
        await user.click(screen.getByRole("button", { name: "Save Changes" }));
        await waitFor(() => {
            expect(screen.getByText("Trait incomplete")).toBeTruthy();
        });
        expect(screen.getAllByText("Definition is required").length).toBeGreaterThan(0);
        expect(screen.getAllByText("At least 1 question is required").length).toBeGreaterThan(0);
    });
    it("shows program count link and opens associated programs drawer", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(async (input) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url.includes("/api/admin/traits?")) {
                return new Response(JSON.stringify({
                    data: [
                        {
                            id: "t1",
                            name: "Associated Trait",
                            category: "ACADEMIC",
                            status: "ACTIVE",
                            definition: "Defined",
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: "A\nB\nC",
                            rubricNegativeSignals: "X\nY",
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: true,
                                percentComplete: 100,
                                missing: [],
                                counts: { positiveSignals: 3, negativeSignals: 2, questions: 1 }
                            },
                            programSummary: {
                                count: 4,
                                topPrograms: [
                                    { programId: "p1", programName: "Program One", bucket: "CRITICAL", weight: 1 },
                                    { programId: "p2", programName: "Program Two", bucket: "VERY_IMPORTANT", weight: 0.75 },
                                    { programId: "p3", programName: "Program Three", bucket: "IMPORTANT", weight: 0.5 }
                                ]
                            },
                            createdAt,
                            updatedAt: createdAt
                        }
                    ]
                }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1/questions")) {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1/programs")) {
                return new Response(JSON.stringify({
                    data: [
                        { programId: "p1", programName: "Program One", bucket: "CRITICAL", weight: 1, updatedAt: createdAt },
                        { programId: "p2", programName: "Program Two", bucket: "VERY_IMPORTANT", weight: 0.75, updatedAt: createdAt }
                    ]
                }), { status: 200 });
            }
            if (url.endsWith("/api/admin/programs")) {
                return new Response(JSON.stringify({
                    data: [
                        { id: "p1", name: "Program One", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt },
                        { id: "p2", name: "Program Two", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt },
                        { id: "p4", name: "Program Four", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt }
                    ]
                }), { status: 200 });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Associated Trait");
        expect(screen.getByText("4 programs")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "4 programs" }));
        const dialog = await screen.findByRole("dialog", { name: "Trait associated programs" });
        expect(within(dialog).getByText("Associated Trait")).toBeTruthy();
        expect(within(dialog).getByText("Program One")).toBeTruthy();
        expect(within(dialog).getByText("Program Two")).toBeTruthy();
    });
    it("creates a draft trait immediately from + New Trait and enables questions", async () => {
        const user = userEvent.setup();
        let createdDraft = false;
        const fetchMock = vi.fn(async (input, init) => {
            const url = typeof input === "string" ? input : input.toString();
            const method = init?.method ?? "GET";
            if (url.includes("/api/admin/traits?") && method === "GET") {
                const traits = [
                    {
                        id: "t1",
                        name: "Existing Trait",
                        category: "ACADEMIC",
                        status: "ACTIVE",
                        definition: "Defined",
                        rubricScaleMin: 0,
                        rubricScaleMax: 5,
                        rubricPositiveSignals: "A\nB\nC",
                        rubricNegativeSignals: "X\nY",
                        rubricFollowUps: null,
                        completeness: {
                            isComplete: true,
                            percentComplete: 100,
                            missing: [],
                            counts: { positiveSignals: 3, negativeSignals: 2, questions: 1 }
                        },
                        createdAt,
                        updatedAt: createdAt
                    }
                ];
                if (createdDraft) {
                    traits.unshift({
                        id: "t-new",
                        name: "Untitled trait",
                        category: "ACADEMIC",
                        status: "DRAFT",
                        definition: "",
                        rubricScaleMin: 0,
                        rubricScaleMax: 5,
                        rubricPositiveSignals: "",
                        rubricNegativeSignals: "",
                        rubricFollowUps: null,
                        completeness: {
                            isComplete: false,
                            percentComplete: 0,
                            missing: ["Definition is required", "At least 1 question is required"],
                            counts: { positiveSignals: 0, negativeSignals: 0, questions: 0 }
                        },
                        createdAt,
                        updatedAt: createdAt
                    });
                }
                return new Response(JSON.stringify({
                    data: traits
                }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1/questions") && method === "GET") {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            if (url.endsWith("/api/admin/traits") && method === "POST") {
                createdDraft = true;
                return new Response(JSON.stringify({
                    data: {
                        id: "t-new",
                        name: "Untitled trait",
                        category: "ACADEMIC",
                        status: "DRAFT",
                        definition: "",
                        rubricScaleMin: 0,
                        rubricScaleMax: 5,
                        rubricPositiveSignals: "",
                        rubricNegativeSignals: "",
                        rubricFollowUps: null,
                        completeness: {
                            isComplete: false,
                            percentComplete: 0,
                            missing: ["Definition is required", "At least 1 question is required"],
                            counts: { positiveSignals: 0, negativeSignals: 0, questions: 0 }
                        },
                        createdAt,
                        updatedAt: createdAt
                    }
                }), { status: 201 });
            }
            if (url.includes("/api/admin/traits/t-new/questions") && method === "GET") {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Existing Trait");
        await user.click(screen.getByRole("button", { name: "+ New Trait" }));
        await screen.findByRole("heading", { name: "Untitled trait" });
        expect(screen.getByRole("heading", { name: "Interaction Design" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Save Quiz Design" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Chat" }));
        expect(screen.getByRole("button", { name: "Save Chat Design" })).toBeTruthy();
    });
    it("keeps prior selection when draft creation fails", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(async (input, init) => {
            const url = typeof input === "string" ? input : input.toString();
            const method = init?.method ?? "GET";
            if (url.includes("/api/admin/traits?") && method === "GET") {
                return new Response(JSON.stringify({
                    data: [
                        {
                            id: "t1",
                            name: "Existing Trait",
                            category: "ACADEMIC",
                            status: "ACTIVE",
                            definition: "Defined",
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: "A\nB\nC",
                            rubricNegativeSignals: "X\nY",
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: true,
                                percentComplete: 100,
                                missing: [],
                                counts: { positiveSignals: 3, negativeSignals: 2, questions: 1 }
                            },
                            createdAt,
                            updatedAt: createdAt
                        }
                    ]
                }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1/questions") && method === "GET") {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            if (url.endsWith("/api/admin/traits") && method === "POST") {
                return new Response(JSON.stringify({ error: { message: "Create failed" } }), { status: 500 });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Existing Trait");
        const existingRow = screen.getByTestId("trait-row-t1");
        await user.click(existingRow);
        expect(existingRow.getAttribute("aria-current")).toBe("true");
        await user.click(screen.getByRole("button", { name: "+ New Trait" }));
        await waitFor(() => {
            expect(screen.getByText("Create failed")).toBeTruthy();
        });
        expect(existingRow.getAttribute("aria-current")).toBe("true");
        expect(screen.queryByText("Untitled trait")).toBeNull();
    });
    it("shows creating lock guidance while new trait request is in flight", async () => {
        const user = userEvent.setup();
        let createdDraft = false;
        const createRequestControl = {};
        const fetchMock = vi.fn(async (input, init) => {
            const url = typeof input === "string" ? input : input.toString();
            const method = init?.method ?? "GET";
            if (url.includes("/api/admin/traits?") && method === "GET") {
                const traits = [
                    {
                        id: "t1",
                        name: "Existing Trait",
                        category: "ACADEMIC",
                        status: "ACTIVE",
                        definition: "Defined",
                        rubricScaleMin: 0,
                        rubricScaleMax: 5,
                        rubricPositiveSignals: "A\nB\nC",
                        rubricNegativeSignals: "X\nY",
                        rubricFollowUps: null,
                        completeness: {
                            isComplete: true,
                            percentComplete: 100,
                            missing: [],
                            counts: { positiveSignals: 3, negativeSignals: 2, questions: 1 }
                        },
                        createdAt,
                        updatedAt: createdAt
                    }
                ];
                if (createdDraft) {
                    traits.unshift({
                        id: "t-new",
                        name: "Untitled trait",
                        category: "ACADEMIC",
                        status: "DRAFT",
                        definition: "",
                        rubricScaleMin: 0,
                        rubricScaleMax: 5,
                        rubricPositiveSignals: "",
                        rubricNegativeSignals: "",
                        rubricFollowUps: null,
                        completeness: {
                            isComplete: false,
                            percentComplete: 0,
                            missing: ["Definition is required", "At least 1 question is required"],
                            counts: { positiveSignals: 0, negativeSignals: 0, questions: 0 }
                        },
                        createdAt,
                        updatedAt: createdAt
                    });
                }
                return new Response(JSON.stringify({ data: traits }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1/questions") && method === "GET") {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t-new/questions") && method === "GET") {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            if (url.endsWith("/api/admin/traits") && method === "POST") {
                return new Promise((resolve) => {
                    createRequestControl.resolve = () => {
                        createdDraft = true;
                        resolve(new Response(JSON.stringify({
                            data: {
                                id: "t-new",
                                name: "Untitled trait",
                                category: "ACADEMIC",
                                status: "DRAFT",
                                definition: "",
                                rubricScaleMin: 0,
                                rubricScaleMax: 5,
                                rubricPositiveSignals: "",
                                rubricNegativeSignals: "",
                                rubricFollowUps: null,
                                completeness: {
                                    isComplete: false,
                                    percentComplete: 0,
                                    missing: ["Definition is required", "At least 1 question is required"],
                                    counts: { positiveSignals: 0, negativeSignals: 0, questions: 0 }
                                },
                                createdAt,
                                updatedAt: createdAt
                            }
                        }), { status: 201 }));
                    };
                });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Existing Trait");
        await user.click(screen.getByRole("button", { name: "+ New Trait" }));
        await screen.findByText("Creating new trait... interview settings are temporarily locked.");
        expect(screen.getByText("Preparing interview setup")).toBeTruthy();
        expect(screen.getByText("Creating your new trait. Interview questions will appear in a moment.")).toBeTruthy();
        const scoringSignalsSection = screen.getByRole("heading", { name: "Scoring Signals" }).closest("section");
        expect(scoringSignalsSection).toBeTruthy();
        const rubricGenerateButton = within(scoringSignalsSection).getByRole("button", { name: "Generate with AI" });
        expect(rubricGenerateButton.disabled).toBe(true);
        expect(rubricGenerateButton.getAttribute("title")).toBe("Finish creating the trait to enable");
        if (createRequestControl.resolve) {
            createRequestControl.resolve();
        }
        await screen.findByRole("heading", { name: "Untitled trait" });
    });
    it("locks scoring and questions until trait changes are saved", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(async (input, init) => {
            const url = typeof input === "string" ? input : input.toString();
            const method = init?.method ?? "GET";
            if (url.includes("/api/admin/traits?") && method === "GET") {
                return new Response(JSON.stringify({
                    data: [
                        {
                            id: "t1",
                            name: "Existing Trait",
                            category: "ACADEMIC",
                            status: "ACTIVE",
                            definition: "Defined",
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: "A\nB\nC",
                            rubricNegativeSignals: "X\nY",
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: true,
                                percentComplete: 100,
                                missing: [],
                                counts: { positiveSignals: 3, negativeSignals: 2, questions: 1 }
                            },
                            createdAt,
                            updatedAt: createdAt
                        }
                    ]
                }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1/questions") && method === "GET") {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Existing Trait");
        await user.click(screen.getByTestId("trait-row-t1"));
        await user.clear(screen.getByLabelText("Name"));
        await user.type(screen.getByLabelText("Name"), "Changed Trait");
        expect(screen.getAllByText(/Save this trait to enable question generation and scoring setup\./).length).toBeGreaterThan(0);
        expect(screen.getByText("Use Save Changes above, then return here to edit quiz/chat questions.")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Save Quiz Design" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Save Chat Design" })).toBeNull();
        const scoringSignalsSection = screen.getByRole("heading", { name: "Scoring Signals" }).closest("section");
        expect(scoringSignalsSection).toBeTruthy();
        const rubricGenerateButton = within(scoringSignalsSection).getByRole("button", { name: "Generate with AI" });
        expect(rubricGenerateButton.disabled).toBe(true);
        expect(rubricGenerateButton.getAttribute("title")).toBe("Save Changes to enable");
    });
    it("shows advanced student-facing label guidance and why-use popover copy", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(async (input, init) => {
            const url = typeof input === "string" ? input : input.toString();
            const method = init?.method ?? "GET";
            if (url.includes("/api/admin/traits?") && method === "GET") {
                return new Response(JSON.stringify({
                    data: [
                        {
                            id: "t1",
                            name: "Guidance Trait",
                            category: "ACADEMIC",
                            status: "ACTIVE",
                            definition: "Defined",
                            rubricScaleMin: 0,
                            rubricScaleMax: 5,
                            rubricPositiveSignals: "A\nB\nC",
                            rubricNegativeSignals: "X\nY",
                            rubricFollowUps: null,
                            completeness: {
                                isComplete: true,
                                percentComplete: 100,
                                missing: [],
                                counts: { positiveSignals: 3, negativeSignals: 2, questions: 1 }
                            },
                            createdAt,
                            updatedAt: createdAt
                        }
                    ]
                }), { status: 200 });
            }
            if (url.includes("/api/admin/traits/t1/questions") && method === "GET") {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        renderPage();
        await screen.findByText("Guidance Trait");
        const studentFacingSummary = screen.getByText("Student-Facing Label", { selector: "summary" });
        await user.click(studentFacingSummary);
        const advancedSummary = await screen.findByText("Advanced (Optional - visuals + grouping)", { selector: "summary" });
        await user.click(advancedSummary);
        expect(screen.getByText("Optional controls for result grouping and visuals. Does not affect scoring.")).toBeTruthy();
        expect(screen.getByText("Groups traits into personality-style results (e.g., Analyst, Builder) for the reveal headline.")).toBeTruthy();
        expect(screen.getByText("Results reveal headline and trait grouping.")).toBeTruthy();
        expect(screen.getByText("Icon token shown next to this label in answer cards, trait sidebar, and results.")).toBeTruthy();
        expect(screen.getByText("Answer cards, trait sidebar, results.")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Why use this?" }));
        expect(screen.getByText("Archetype: enables a personality-style reveal headline.")).toBeTruthy();
        expect(screen.getByText("Icon: makes choices and results more visual.")).toBeTruthy();
        expect(screen.getByText("Mood: helps traits feel consistent with the quiz theme.")).toBeTruthy();
    });
});

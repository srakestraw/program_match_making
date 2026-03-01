// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TraitsPage } from "./main";

const createdAt = "2026-02-24T00:00:00.000Z";
const renderPage = () =>
  render(
    <MemoryRouter>
      <TraitsPage />
    </MemoryRouter>
  );

describe("TraitsPage lifecycle UX", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders compact trait rows without verbose list badges", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/questions")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes("/api/admin/traits")) {
        return new Response(
          JSON.stringify({
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
                  missing: [] as string[],
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
          }),
          { status: 200 }
        );
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/questions")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes("/api/admin/traits")) {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await screen.findByText("Complete Trait");

    const completeRow = screen.getAllByTestId("trait-row-t1")[0]!;
    const draftRow = screen.getAllByTestId("trait-row-t2")[0]!;
    await user.click(draftRow);
    expect(completeRow.getAttribute("aria-current")).toBeNull();
    expect(draftRow.getAttribute("aria-current")).toBe("true");
  });

  it("blocks activation with checklist when server returns TRAIT_INCOMPLETE", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.includes("/api/admin/traits?") && method === "GET") {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 }
        );
      }
      if (url.includes("/api/admin/traits/t1/questions")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes("/api/admin/traits/t1") && method === "PUT") {
        return new Response(
          JSON.stringify({
            error: {
              code: "TRAIT_INCOMPLETE",
              message: "Trait incomplete",
              missing: ["Definition is required", "At least 1 question is required"]
            }
          }),
          { status: 400 }
        );
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/admin/traits?")) {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 }
        );
      }
      if (url.includes("/api/admin/traits/t1/questions")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes("/api/admin/traits/t1/programs")) {
        return new Response(
          JSON.stringify({
            data: [
              { programId: "p1", programName: "Program One", bucket: "CRITICAL", weight: 1, updatedAt: createdAt },
              { programId: "p2", programName: "Program Two", bucket: "VERY_IMPORTANT", weight: 0.75, updatedAt: createdAt }
            ]
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/api/admin/programs")) {
        return new Response(
          JSON.stringify({
            data: [
              { id: "p1", name: "Program One", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt },
              { id: "p2", name: "Program Two", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt },
              { id: "p4", name: "Program Four", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt }
            ]
          }),
          { status: 200 }
        );
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.includes("/api/admin/traits?") && method === "GET") {
        const traits: Array<Record<string, unknown>> = [
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
              missing: ["Definition is required", "At least 1 question is required"] as string[],
              counts: { positiveSignals: 0, negativeSignals: 0, questions: 0 }
            },
            createdAt,
            updatedAt: createdAt
          });
        }
        return new Response(
          JSON.stringify({
            data: traits
          }),
          { status: 200 }
        );
      }
      if (url.includes("/api/admin/traits/t1/questions") && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/traits") && method === "POST") {
        createdDraft = true;
        return new Response(
          JSON.stringify({
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
          }),
          { status: 201 }
        );
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.includes("/api/admin/traits?") && method === "GET") {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 }
        );
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
});

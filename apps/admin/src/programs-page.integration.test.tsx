// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgramsPage } from "./main";

type ProgramTraitRow = {
  id: string;
  programId: string;
  traitId: string;
  bucket: "CRITICAL" | "VERY_IMPORTANT" | "IMPORTANT" | "NICE_TO_HAVE";
  sortOrder: number;
  notes: string | null;
  trait: {
    id: string;
    name: string;
    category: string;
    status?: "DRAFT" | "IN_REVIEW" | "ACTIVE" | "DEPRECATED";
    definition: string | null;
    rubricScaleMin: number;
    rubricScaleMax: number;
    rubricPositiveSignals: string | null;
    rubricNegativeSignals: string | null;
    rubricFollowUps: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

const createdAt = "2026-02-24T00:00:00.000Z";

describe("ProgramsPage remove + save flow", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("removes a trait after confirm, saves payload, and keeps it removed after reload", async () => {
    const user = userEvent.setup();
    const programId = "program-1";
    const traitA = {
      id: "trait-a",
      name: "Analytical Thinking",
      category: "ACADEMIC",
      definition: null,
      rubricScaleMin: 0,
      rubricScaleMax: 5,
      rubricPositiveSignals: null,
      rubricNegativeSignals: null,
      rubricFollowUps: null,
      createdAt,
      updatedAt: createdAt
    };
    const traitB = {
      ...traitA,
      id: "trait-b",
      name: "Communication",
      category: "INTERPERSONAL"
    };

    let programTraits: ProgramTraitRow[] = [
      {
        id: "pt-1",
        programId,
        traitId: traitA.id,
        bucket: "CRITICAL",
        sortOrder: 0,
        notes: null,
        trait: traitA
      },
      {
        id: "pt-2",
        programId,
        traitId: traitB.id,
        bucket: "IMPORTANT",
        sortOrder: 0,
        notes: null,
        trait: traitB
      }
    ];

    const putBodies: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/admin/programs") && method === "GET") {
        return new Response(JSON.stringify({ data: [{ id: programId, name: "Data Science", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt }] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [traitA, traitB] }), { status: 200 });
      }
      if (url.endsWith(`/api/admin/programs/${programId}/traits`) && method === "GET") {
        return new Response(JSON.stringify({ data: programTraits }), { status: 200 });
      }
      if (url.endsWith(`/api/admin/programs/${programId}/traits`) && method === "PUT") {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as { items: Array<{ traitId: string; bucket: ProgramTraitRow["bucket"]; sortOrder: number }> };
        putBodies.push(parsed);
        programTraits = parsed.items.map((item, index) => {
          const trait = item.traitId === traitA.id ? traitA : traitB;
          return {
            id: `saved-${index}`,
            programId,
            traitId: item.traitId,
            bucket: item.bucket,
            sortOrder: item.sortOrder,
            notes: null,
            trait
          };
        });
        return new Response(JSON.stringify({ data: programTraits }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProgramsPage />);

    await screen.findByRole("heading", { name: "Trait Priority Board" });
    await screen.findByText("Analytical Thinking");
    await screen.findByText("Communication");

    await user.click(screen.getByRole("button", { name: "Remove Analytical Thinking from board" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove trait from this program?" });
    await user.click(within(dialog).getByRole("button", { name: /^Remove Analytical Thinking from board$/ }));

    await waitFor(() => {
      expect(screen.queryByText("Analytical Thinking")).toBeNull();
    });
    expect(screen.getByText("Unsaved changes")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(putBodies).toHaveLength(1);
    });
    expect(putBodies[0]).toEqual({
      items: [{ traitId: "trait-b", bucket: "IMPORTANT", sortOrder: 0 }]
    });

    await screen.findByText("All changes saved");
    expect(screen.queryByText("Analytical Thinking")).toBeNull();
  });

  it("shows scoring readiness callout when program has no traits", async () => {
    const programId = "program-empty";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/admin/programs") && method === "GET") {
        return new Response(
          JSON.stringify({
            data: [{ id: programId, name: "Empty Program", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt }]
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/api/admin/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.endsWith(`/api/admin/programs/${programId}/traits`) && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProgramsPage />);

    await screen.findByRole("heading", { name: "Trait Priority Board" });
    await screen.findByText("This program cannot be scored yet.");
    expect(screen.getByText("Add at least 1 trait to the priority board.")).toBeTruthy();
    expect(screen.getByText("Mark at least 1 assigned trait as Active.")).toBeTruthy();
  });

  it("shows missing active-trait blocker when only non-active traits are assigned", async () => {
    const programId = "program-status";
    const draftTrait = {
      id: "trait-draft",
      name: "Draft Trait",
      category: "ACADEMIC",
      status: "DRAFT" as const,
      definition: null,
      rubricScaleMin: 0,
      rubricScaleMax: 5,
      rubricPositiveSignals: null,
      rubricNegativeSignals: null,
      rubricFollowUps: null,
      createdAt,
      updatedAt: createdAt
    };
    const activeTrait = {
      ...draftTrait,
      id: "trait-active",
      name: "Active Trait",
      status: "ACTIVE" as const
    };

    const programTraits: ProgramTraitRow[] = [
      {
        id: "pt-draft",
        programId,
        traitId: draftTrait.id,
        bucket: "IMPORTANT",
        sortOrder: 0,
        notes: null,
        trait: draftTrait
      }
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/admin/programs") && method === "GET") {
        return new Response(
          JSON.stringify({
            data: [{ id: programId, name: "Status Program", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt }]
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/api/admin/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [draftTrait, activeTrait] }), { status: 200 });
      }
      if (url.endsWith(`/api/admin/programs/${programId}/traits`) && method === "GET") {
        return new Response(JSON.stringify({ data: programTraits }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProgramsPage />);

    await screen.findByRole("heading", { name: "Trait Priority Board" });
    await screen.findByText("This program cannot be scored yet.");
    expect(screen.getByText("Mark at least 1 assigned trait as Active.")).toBeTruthy();
  });

  it("hides scoring blocker when at least one assigned trait is Active", async () => {
    const programId = "program-active";
    const draftTrait = {
      id: "trait-draft",
      name: "Draft Trait",
      category: "ACADEMIC",
      status: "DRAFT" as const,
      definition: null,
      rubricScaleMin: 0,
      rubricScaleMax: 5,
      rubricPositiveSignals: null,
      rubricNegativeSignals: null,
      rubricFollowUps: null,
      createdAt,
      updatedAt: createdAt
    };
    const activeTrait = {
      ...draftTrait,
      id: "trait-active",
      name: "Active Trait",
      status: "ACTIVE" as const
    };
    const programTraits: ProgramTraitRow[] = [
      {
        id: "pt-draft",
        programId,
        traitId: draftTrait.id,
        bucket: "IMPORTANT",
        sortOrder: 0,
        notes: null,
        trait: draftTrait
      },
      {
        id: "pt-active",
        programId,
        traitId: activeTrait.id,
        bucket: "CRITICAL",
        sortOrder: 0,
        notes: null,
        trait: activeTrait
      }
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/admin/programs") && method === "GET") {
        return new Response(
          JSON.stringify({
            data: [{ id: programId, name: "Active Program", description: null, degreeLevel: null, department: null, createdAt, updatedAt: createdAt }]
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/api/admin/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [draftTrait, activeTrait] }), { status: 200 });
      }
      if (url.endsWith(`/api/admin/programs/${programId}/traits`) && method === "GET") {
        return new Response(JSON.stringify({ data: programTraits }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProgramsPage />);

    await screen.findByRole("heading", { name: "Trait Priority Board" });
    await waitFor(() => {
      expect(screen.queryByText("This program cannot be scored yet.")).toBeNull();
    });
  });

  it("filters programs from sidebar search and keeps selected row state", async () => {
    const user = userEvent.setup();
    const programA = {
      id: "program-a",
      name: "Analytics M.S.",
      description: null,
      degreeLevel: "Masters",
      department: "J. Mack Robinson College of Business",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    };
    const programB = {
      id: "program-b",
      name: "Cybersecurity M.S.",
      description: null,
      degreeLevel: "Masters",
      department: null,
      isActive: false,
      createdAt,
      updatedAt: createdAt
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/admin/programs") && method === "GET") {
        return new Response(JSON.stringify({ data: [programA, programB] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes("/api/admin/programs/") && url.endsWith("/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProgramsPage />);

    await screen.findByText("Analytics M.S.");
    await screen.findByText("Cybersecurity M.S.");
    expect(within(screen.getByTestId("program-row-program-a")).getByText("Active")).toBeTruthy();
    expect(within(screen.getByTestId("program-row-program-b")).getByText("Draft")).toBeTruthy();

    await user.click(screen.getByTestId("program-row-program-b"));
    expect(screen.getByTestId("program-row-program-b").getAttribute("aria-current")).toBe("true");

    await user.type(screen.getByPlaceholderText("Search programs..."), "cyber");
    await waitFor(() => {
      expect(screen.queryByText("Analytics M.S.")).toBeNull();
    });
    expect(screen.getByTestId("program-row-program-b").getAttribute("aria-current")).toBe("true");

    await user.clear(screen.getByPlaceholderText("Search programs..."));
    await user.type(screen.getByPlaceholderText("Search programs..."), "no-match");
    await screen.findByText("No programs found.");

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    await screen.findByText("Analytics M.S.");
    expect(screen.getByTestId("program-row-program-b").getAttribute("aria-current")).toBe("true");
  });

  it("persists program active toggle immediately and updates status", async () => {
    const user = userEvent.setup();
    const programId = "program-toggle";
    let isActive = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/admin/programs") && method === "GET") {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: programId,
                name: "Toggle Program",
                description: null,
                degreeLevel: "Masters",
                department: "Business",
                isActive,
                createdAt,
                updatedAt: createdAt
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/api/admin/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes("/api/admin/programs/") && url.endsWith("/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.endsWith(`/api/admin/programs/${programId}/status`) && method === "PATCH") {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as { isActive: boolean };
        isActive = parsed.isActive;
        return new Response(
          JSON.stringify({
            data: {
              id: programId,
              name: "Toggle Program",
              description: null,
              degreeLevel: "Masters",
              department: "Business",
              isActive,
              createdAt,
              updatedAt: createdAt
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProgramsPage />);

    await screen.findByText("Toggle Program");
    expect(within(screen.getByTestId(`program-row-${programId}`)).getByText("Active")).toBeTruthy();

    const toggle = screen.getByRole("switch", { name: "Active" });
    await user.click(toggle);

    await screen.findByText("Program marked Inactive.");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/admin/programs/${programId}/status`),
      expect.objectContaining({ method: "PATCH" })
    );
    expect(within(screen.getByTestId(`program-row-${programId}`)).getByText("Inactive")).toBeTruthy();
  });

  it("shows inactive warning banner and quick inactive filter", async () => {
    const user = userEvent.setup();
    const activeProgram = {
      id: "program-active-banner",
      name: "Active Program",
      description: null,
      degreeLevel: "Masters",
      department: "Business",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    };
    const inactiveProgram = {
      id: "program-inactive-banner",
      name: "Inactive Program",
      description: null,
      degreeLevel: "Masters",
      department: "Business",
      isActive: false,
      createdAt,
      updatedAt: createdAt
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/admin/programs") && method === "GET") {
        return new Response(JSON.stringify({ data: [activeProgram, inactiveProgram] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes("/api/admin/programs/") && url.endsWith("/traits") && method === "GET") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProgramsPage />);

    await screen.findByText("Inactive Program");
    await screen.findByText("1 program is Inactive and will not be used in matchmaking.");

    await user.click(screen.getByRole("button", { name: "Show inactive" }));
    expect(screen.queryByText("Active Program")).toBeNull();
    await screen.findByText("Inactive Program");
    await screen.findByText("Filtering to Inactive programs.");
  });
});

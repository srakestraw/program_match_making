// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

    await user.click(screen.getByRole("button", { name: "Save Board" }));

    await waitFor(() => {
      expect(putBodies).toHaveLength(1);
    });
    expect(putBodies[0]).toEqual({
      items: [{ traitId: "trait-b", bucket: "IMPORTANT", sortOrder: 0 }]
    });

    await screen.findByText("Program board saved.");
    expect(screen.queryByText("Analytical Thinking")).toBeNull();
  });
});

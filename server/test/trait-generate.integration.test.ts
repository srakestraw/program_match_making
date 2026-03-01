import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const findUniqueTraitMock = vi.fn();
const generateTraitSignalsMock = vi.fn();
const generateTraitQuestionsMock = vi.fn();
const generateTraitExperienceDraftMock = vi.fn();

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    trait: {
      findUnique: findUniqueTraitMock
    }
  }
}));

vi.mock("../src/lib/traitContentGeneration.js", () => ({
  generateTraitSignals: (input: unknown) => generateTraitSignalsMock(input),
  generateTraitQuestions: (input: unknown) => generateTraitQuestionsMock(input),
  generateTraitExperienceDraft: (input: unknown) => generateTraitExperienceDraftMock(input)
}));

describe("POST /api/admin/traits/:id/generate-signals and generate-questions", () => {
  beforeEach(() => {
    findUniqueTraitMock.mockReset();
    generateTraitSignalsMock.mockReset();
    generateTraitQuestionsMock.mockReset();
    generateTraitExperienceDraftMock.mockReset();
  });

  it("generate-signals returns generated signals shape", async () => {
    findUniqueTraitMock.mockResolvedValue({
      id: "trait-1",
      name: "Leadership",
      definition: "Leads teams.",
      category: "LEADERSHIP"
    });
    generateTraitSignalsMock.mockResolvedValue({
      positiveSignals: ["Provides concrete examples of leading teams."],
      negativeSignals: ["Cannot give specific examples."],
      followUps: ["Tell me more about a time you resolved conflict."]
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/traits/trait-1/generate-signals");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      positiveSignals: ["Provides concrete examples of leading teams."],
      negativeSignals: ["Cannot give specific examples."],
      followUps: ["Tell me more about a time you resolved conflict."]
    });
    expect(generateTraitSignalsMock).toHaveBeenCalledWith({
      name: "Leadership",
      definition: "Leads teams.",
      category: "LEADERSHIP"
    });
  });

  it("generate-signals returns 404 when trait not found", async () => {
    findUniqueTraitMock.mockResolvedValue(null);

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/traits/missing-id/generate-signals");

    expect(response.status).toBe(404);
    expect(generateTraitSignalsMock).not.toHaveBeenCalled();
  });

  it("generate-questions returns generated questions shape", async () => {
    findUniqueTraitMock.mockResolvedValue({
      id: "trait-2",
      name: "Analytical Thinking",
      definition: "Breaks down complex problems.",
      category: "PROBLEM_SOLVING"
    });
    generateTraitQuestionsMock.mockResolvedValue({
      chatPrompt: "Describe a time you analyzed a complex problem.",
      quizPrompt: "Which response best demonstrates analytical thinking?",
      quizOptions: ["Option A", "Option B", "Option C", "Option D"]
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/traits/trait-2/generate-questions");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      chatPrompt: "Describe a time you analyzed a complex problem.",
      quizPrompt: "Which response best demonstrates analytical thinking?",
      quizOptions: ["Option A", "Option B", "Option C", "Option D"]
    });
    expect(generateTraitQuestionsMock).toHaveBeenCalledWith({
      name: "Analytical Thinking",
      definition: "Breaks down complex problems.",
      category: "PROBLEM_SOLVING"
    });
  });

  it("generate-questions returns 503 when OPENAI_API_KEY missing", async () => {
    findUniqueTraitMock.mockResolvedValue({
      id: "trait-3",
      name: "T",
      definition: null,
      category: "ACADEMIC"
    });
    generateTraitQuestionsMock.mockRejectedValue(new Error("OPENAI_API_KEY is not configured"));

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/traits/trait-3/generate-questions");

    expect(response.status).toBe(503);
    const errMsg =
      typeof response.body.error === "string"
        ? response.body.error
        : (response.body.error as { message?: string })?.message ?? "";
    expect(errMsg).toMatch(/OPENAI_API_KEY|not configured/i);
  });

  it("experience-draft returns generated student-facing content", async () => {
    findUniqueTraitMock.mockResolvedValue({
      id: "trait-4",
      name: "Collaboration",
      definition: "Works well across teams.",
      category: "TEAMWORK"
    });
    generateTraitExperienceDraftMock.mockResolvedValue({
      publicLabel: "Team Connector",
      oneLineHook: "Bring people together to solve hard problems.",
      archetypeTag: "COMMUNICATOR",
      displayIcon: "bridge",
      visualMood: "PLAYFUL"
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app)
      .post("/api/admin/traits/trait-4/experience-draft")
      .send({ action: "gen_z" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      publicLabel: "Team Connector",
      oneLineHook: "Bring people together to solve hard problems.",
      archetypeTag: "COMMUNICATOR",
      displayIcon: "bridge",
      visualMood: "PLAYFUL"
    });
    expect(generateTraitExperienceDraftMock).toHaveBeenCalledWith({
      action: "gen_z",
      name: "Collaboration",
      definition: "Works well across teams.",
      category: "TEAMWORK"
    });
  });
});

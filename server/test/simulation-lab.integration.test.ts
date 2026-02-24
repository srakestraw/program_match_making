import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const brandVoiceFindUniqueMock = vi.fn();
const scenarioFindUniqueMock = vi.fn();
const scenarioFindManyMock = vi.fn();
const simulationFindUniqueMock = vi.fn();
const simulationCreateMock = vi.fn();
const simulationUpdateMock = vi.fn();
const turnCreateMock = vi.fn();
const turnFindUniqueMock = vi.fn();
const turnFindManyMock = vi.fn();
const voiceSampleCreateMock = vi.fn();
const synthesizeVoiceSampleMock = vi.fn();
const txSimulationCreateMock = vi.fn();
const txTurnCreateMock = vi.fn();

const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
  callback({
    conversationSimulation: { create: txSimulationCreateMock },
    conversationTurn: { create: txTurnCreateMock }
  })
);

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    brandVoice: {
      findUnique: brandVoiceFindUniqueMock
    },
    conversationScenario: {
      findUnique: scenarioFindUniqueMock,
      findMany: scenarioFindManyMock
    },
    conversationSimulation: {
      findUnique: simulationFindUniqueMock,
      create: simulationCreateMock,
      update: simulationUpdateMock
    },
    conversationTurn: {
      create: turnCreateMock,
      findUnique: turnFindUniqueMock,
      findMany: turnFindManyMock
    },
    voiceSample: {
      create: voiceSampleCreateMock
    },
    $transaction: transactionMock
  }
}));

vi.mock("../src/lib/simulationVoice.js", () => ({
  synthesizeVoiceSample: synthesizeVoiceSampleMock
}));

describe("simulation lab endpoints", () => {
  beforeEach(() => {
    brandVoiceFindUniqueMock.mockReset();
    scenarioFindUniqueMock.mockReset();
    scenarioFindManyMock.mockReset();
    simulationFindUniqueMock.mockReset();
    simulationCreateMock.mockReset();
    simulationUpdateMock.mockReset();
    turnCreateMock.mockReset();
    turnFindUniqueMock.mockReset();
    turnFindManyMock.mockReset();
    voiceSampleCreateMock.mockReset();
    synthesizeVoiceSampleMock.mockReset();
    txSimulationCreateMock.mockReset();
    txTurnCreateMock.mockReset();
    transactionMock.mockClear();
  });

  it("creates a simulation with first user turn", async () => {
    brandVoiceFindUniqueMock.mockResolvedValue({ id: "voice-1" });
    scenarioFindUniqueMock.mockResolvedValue({
      id: "scenario-1",
      seedPrompt: "Help me understand if this program is right for me."
    });

    const now = new Date("2026-02-24T00:00:00.000Z");
    txSimulationCreateMock.mockResolvedValue({
      id: "simulation-1",
      brandVoiceId: "voice-1",
      scenarioId: "scenario-1",
      persona: "STUDENT",
      customScenario: null,
      stabilityScore: null,
      createdAt: now
    });
    txTurnCreateMock.mockResolvedValue({
      id: "turn-1",
      simulationId: "simulation-1",
      role: "USER",
      content: "Help me understand if this program is right for me.",
      order: 0,
      createdAt: now
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/brand-voices/voice-1/simulations").send({
      scenarioId: "scenario-1",
      persona: "STUDENT"
    });

    expect(response.status).toBe(201);
    expect(response.body.simulation.id).toBe("simulation-1");
    expect(response.body.turns).toHaveLength(1);
    expect(response.body.turns[0].role).toBe("USER");
  });

  it("adds a turn, generates assistant reply, and lowers score on avoid term", async () => {
    const now = new Date("2026-02-24T00:00:00.000Z");
    simulationFindUniqueMock.mockResolvedValue({
      id: "simulation-1",
      persona: "STUDENT",
      customScenario: null,
      scenario: { id: "scenario-1", title: "ROI concern", seedPrompt: "Tell me about outcomes." },
      turns: [],
      brandVoice: {
        id: "voice-1",
        name: "Admissions Voice",
        primaryTone: "professional",
        toneModifiers: ["encouraging"],
        toneProfile: { formality: 75, warmth: 60, directness: 70, confidence: 80, energy: 55 },
        styleFlags: ["clear", "credible"],
        avoidFlags: ["guarantee"],
        canonicalExamples: [],
        createdAt: now,
        updatedAt: now
      }
    });

    turnCreateMock
      .mockResolvedValueOnce({
        id: "turn-user",
        simulationId: "simulation-1",
        role: "USER",
        content: "Can you guarantee I will get a job?",
        order: 0,
        createdAt: now
      })
      .mockResolvedValueOnce({
        id: "turn-assistant",
        simulationId: "simulation-1",
        role: "ASSISTANT",
        content: "Assistant output",
        order: 1,
        createdAt: now
      });
    simulationUpdateMock.mockResolvedValue({ id: "simulation-1" });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/simulations/simulation-1/turns").send({
      userMessage: "Can you guarantee I will get a job?"
    });

    expect(response.status).toBe(200);
    expect(response.body.assistantTurn.role).toBe("ASSISTANT");
    expect(response.body.stabilityScore).toBeLessThan(100);
    expect(response.body.avoidHits).toContain("guarantee");
  });

  it("creates voice sample URL for assistant turn", async () => {
    synthesizeVoiceSampleMock.mockResolvedValue({
      provider: "openai",
      audioUrl: "data:audio/mpeg;base64,ZmFrZQ=="
    });
    turnFindUniqueMock.mockResolvedValue({
      id: "turn-assistant",
      simulationId: "simulation-1",
      role: "ASSISTANT",
      content: "Sample",
      order: 1,
      createdAt: new Date("2026-02-24T00:00:00.000Z")
    });
    voiceSampleCreateMock.mockResolvedValue({
      id: "sample-1",
      simulationId: "simulation-1",
      turnId: "turn-assistant",
      provider: "openai",
      voiceName: null,
      audioUrl: "data:audio/mpeg;base64,ZmFrZQ==",
      createdAt: new Date("2026-02-24T00:00:00.000Z")
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/simulations/simulation-1/voice-samples").send({
      turnId: "turn-assistant"
    });

    expect(response.status).toBe(201);
    expect(response.body.data.audioUrl).toBe("data:audio/mpeg;base64,ZmFrZQ==");
    expect(response.body.data.provider).toBe("openai");
  });

  it("runs pressure test and stores 10 turns", async () => {
    const now = new Date("2026-02-24T00:00:00.000Z");
    simulationFindUniqueMock.mockResolvedValue({
      id: "simulation-1",
      persona: "PARENT",
      customScenario: null,
      scenario: { id: "scenario-1", title: "Objection", seedPrompt: "Seed" },
      turns: [
        {
          id: "seed-user",
          simulationId: "simulation-1",
          role: "USER",
          content: "Seed",
          order: 0,
          createdAt: now
        }
      ],
      brandVoice: {
        id: "voice-1",
        name: "Admissions Voice",
        primaryTone: "professional",
        toneModifiers: ["encouraging"],
        toneProfile: { formality: 75, warmth: 70, directness: 60, confidence: 80, energy: 55 },
        styleFlags: ["clear", "credible"],
        avoidFlags: ["overpromise"],
        canonicalExamples: [],
        createdAt: now,
        updatedAt: now
      }
    });
    turnCreateMock.mockImplementation(async ({ data }: { data: { order: number; role: string; content: string } }) => ({
      id: `turn-${data.order}`,
      simulationId: "simulation-1",
      role: data.role,
      content: data.content,
      order: data.order,
      createdAt: now
    }));
    simulationUpdateMock.mockResolvedValue({ id: "simulation-1" });
    turnFindManyMock.mockResolvedValue(
      Array.from({ length: 11 }).map((_, index) => ({
        id: `turn-${index}`,
        simulationId: "simulation-1",
        role: index % 2 === 0 ? "USER" : "ASSISTANT",
        content: `content-${index}`,
        order: index,
        createdAt: now
      }))
    );

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/simulations/simulation-1/pressure-test").send({});

    expect(response.status).toBe(200);
    expect(turnCreateMock).toHaveBeenCalledTimes(10);
    expect(response.body.transcript.length).toBeGreaterThanOrEqual(11);
  });
});

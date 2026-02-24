import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.DATABASE_URL ??= "file:./test.db";

let prisma: typeof import("../src/lib/prisma.js")["prisma"];
let createApp: typeof import("../src/app.js")["createApp"];

describe.sequential("failure mode integration", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns controlled error when OPENAI_API_KEY missing for token endpoint", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const app = createApp();
    const response = await request(app).post("/api/realtime/token");

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: "OPENAI_KEY_MISSING",
        message: "OPENAI_API_KEY is not configured"
      })
    );

    if (previous) {
      process.env.OPENAI_API_KEY = previous;
    }
  });

  it("returns controlled error when chat scoring upstream fails", async () => {
    const suffix = Date.now().toString(36);

    const trait = await prisma.trait.create({
      data: {
        name: `Failure Trait ${suffix}`,
        category: "MOTIVATION",
        rubricScaleMin: 0,
        rubricScaleMax: 5
      }
    });

    const program = await prisma.program.create({
      data: { name: `Failure Program ${suffix}` }
    });

    await prisma.programTrait.create({
      data: {
        programId: program.id,
        traitId: trait.id,
        bucket: "CRITICAL",
        sortOrder: 0
      }
    });

    const session = await prisma.candidateSession.create({
      data: {
        mode: "chat",
        status: "completed",
        programId: program.id,
        endedAt: new Date()
      }
    });

    await prisma.transcriptTurn.createMany({
      data: [
        { sessionId: session.id, ts: new Date(), speaker: "assistant", text: "Tell me about your goals." },
        { sessionId: session.id, ts: new Date(), speaker: "candidate", text: "I want to lead impact projects." }
      ]
    });

    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "upstream down" } })
    });

    const originalFetch = global.fetch;
    (global.fetch as unknown) = fetchMock as typeof fetch;

    const app = createApp();
    const response = await request(app).post(`/api/sessions/${session.id}/score`).send({
      mode: "chat",
      programId: program.id
    });

    expect(response.status).toBe(502);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: "SCORING_UPSTREAM_FAILED",
        message: "upstream down"
      })
    );

    global.fetch = originalFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  });
});

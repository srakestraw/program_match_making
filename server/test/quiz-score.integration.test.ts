import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// DATABASE_URL from .env (RDS PostgreSQL)

let prisma: typeof import("../src/lib/prisma.js")["prisma"];
let createApp: typeof import("../src/app.js")["createApp"];

describe("quiz scoring integration", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("scores quiz answers and persists scorecard + trait scores", async () => {
    const suffix = Date.now().toString(36);

    const [traitA, traitB] = await Promise.all([
      prisma.trait.create({
        data: {
          name: `Quiz Trait A ${suffix}`,
          category: "MOTIVATION",
          status: "ACTIVE",
          rubricScaleMin: 0,
          rubricScaleMax: 5
        }
      }),
      prisma.trait.create({
        data: {
          name: `Quiz Trait B ${suffix}`,
          category: "INTERPERSONAL",
          status: "ACTIVE",
          rubricScaleMin: 0,
          rubricScaleMax: 5
        }
      })
    ]);

    const program = await prisma.program.create({
      data: {
        name: `Quiz Program ${suffix}`,
        isActive: true
      }
    });

    await prisma.programTrait.createMany({
      data: [
        { programId: program.id, traitId: traitA.id, bucket: "CRITICAL", sortOrder: 0 },
        { programId: program.id, traitId: traitB.id, bucket: "IMPORTANT", sortOrder: 0 }
      ]
    });

    const [questionA, questionB] = await Promise.all([
      prisma.traitQuestion.create({
        data: {
          traitId: traitA.id,
          type: "QUIZ",
          prompt: "How motivated are you?",
          optionsJson: JSON.stringify(["Low [1]", "High [5]"])
        }
      }),
      prisma.traitQuestion.create({
        data: {
          traitId: traitB.id,
          type: "QUIZ",
          prompt: "How collaborative are you?",
          optionsJson: JSON.stringify(["Not much [1]", "Very [4]"])
        }
      })
    ]);

    const app = createApp();

    const sessionResponse = await request(app).post("/api/sessions").send({ mode: "quiz" });
    expect(sessionResponse.status).toBe(201);

    const sessionId = sessionResponse.body.id as string;

    const scoreResponse = await request(app)
      .post(`/api/sessions/${sessionId}/score`)
      .send({
        mode: "quiz",
        programId: program.id,
        responses: [
          { questionId: questionA.id, answer: "High" },
          { questionId: questionB.id, answer: "Very" }
        ]
      });

    expect(scoreResponse.status).toBe(200);
    expect(scoreResponse.body.data.programId).toBe(program.id);
    expect(scoreResponse.body.data.perTrait).toHaveLength(2);

    const saved = await prisma.scorecard.findMany({
      where: { sessionId, programId: program.id },
      include: { traitScores: true }
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]?.traitScores).toHaveLength(2);
    expect(saved[0]?.overallScore).toBeGreaterThan(0);
  });
});

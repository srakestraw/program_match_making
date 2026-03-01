import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

let prisma: typeof import("../src/lib/prisma.js")["prisma"];
let createApp: typeof import("../src/app.js")["createApp"];

describe("trait lifecycle and scoring eligibility", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks ACTIVE status transition for incomplete traits", async () => {
    const suffix = Date.now().toString(36);
    const trait = await prisma.trait.create({
      data: {
        name: `Lifecycle Incomplete ${suffix}`,
        category: "MOTIVATION"
      }
    });
    const app = createApp();
    const response = await request(app).put(`/api/admin/traits/${trait.id}`).send({
      status: "ACTIVE"
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TRAIT_INCOMPLETE");
    expect(Array.isArray(response.body.error.missing)).toBe(true);
  });

  it("allows IN_REVIEW status transition for incomplete traits", async () => {
    const suffix = Date.now().toString(36);
    const trait = await prisma.trait.create({
      data: {
        name: `Lifecycle Review ${suffix}`,
        category: "MOTIVATION"
      }
    });
    const app = createApp();
    const response = await request(app).put(`/api/admin/traits/${trait.id}`).send({
      status: "IN_REVIEW"
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("IN_REVIEW");
  });

  it("searches traits case-insensitively", async () => {
    const suffix = Date.now().toString(36);
    await prisma.trait.create({
      data: {
        name: `CaseSensitive Trait ${suffix}`,
        category: "MOTIVATION"
      }
    });

    const app = createApp();
    const response = await request(app).get("/api/admin/traits").query({ q: `casesensitive trait ${suffix}` });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.some((item: { name: string }) => item.name === `CaseSensitive Trait ${suffix}`)).toBe(true);
  });

  it("excludes non-active traits from scoring and returns warnings", async () => {
    const suffix = Date.now().toString(36);
    const activeTrait = await prisma.trait.create({
      data: {
        name: `Lifecycle Active ${suffix}`,
        category: "MOTIVATION",
        definition: "Has complete content",
        rubricPositiveSignals: "One\nTwo\nThree",
        rubricNegativeSignals: "Bad one\nBad two"
      }
    });
    const draftTrait = await prisma.trait.create({
      data: {
        name: `Lifecycle Draft ${suffix}`,
        category: "INTERPERSONAL",
        definition: "Still draft",
        rubricPositiveSignals: "One\nTwo\nThree",
        rubricNegativeSignals: "Bad one\nBad two"
      }
    });

    await prisma.traitQuestion.createMany({
      data: [
        {
          traitId: activeTrait.id,
          type: "QUIZ",
          prompt: "Active question",
          optionsJson: JSON.stringify(["Low [1]", "High [5]"])
        },
        {
          traitId: draftTrait.id,
          type: "QUIZ",
          prompt: "Draft question",
          optionsJson: JSON.stringify(["Low [1]", "High [5]"])
        }
      ]
    });

    await prisma.trait.update({
      where: { id: activeTrait.id },
      data: { status: "ACTIVE" }
    });

    const program = await prisma.program.create({
      data: {
        name: `Lifecycle Program ${suffix}`,
        isActive: true
      }
    });

    await prisma.programTrait.createMany({
      data: [
        { programId: program.id, traitId: activeTrait.id, bucket: "CRITICAL", sortOrder: 0 },
        { programId: program.id, traitId: draftTrait.id, bucket: "IMPORTANT", sortOrder: 0 }
      ]
    });

    const app = createApp();
    const sessionResponse = await request(app).post("/api/sessions").send({ mode: "quiz" });
    expect(sessionResponse.status).toBe(201);
    const sessionId = sessionResponse.body.id as string;

    const activeQuestion = await prisma.traitQuestion.findFirstOrThrow({
      where: { traitId: activeTrait.id, type: "QUIZ" }
    });
    const draftQuestion = await prisma.traitQuestion.findFirstOrThrow({
      where: { traitId: draftTrait.id, type: "QUIZ" }
    });

    const scoreResponse = await request(app)
      .post(`/api/sessions/${sessionId}/score`)
      .send({
        mode: "quiz",
        programId: program.id,
        responses: [
          { questionId: activeQuestion.id, answer: "High" },
          { questionId: draftQuestion.id, answer: "High" }
        ]
      });

    expect(scoreResponse.status).toBe(200);
    expect(scoreResponse.body.data.perTrait).toHaveLength(1);
    expect(scoreResponse.body.data.perTrait[0].traitId).toBe(activeTrait.id);
    expect(Array.isArray(scoreResponse.body.data.warnings)).toBe(true);
    expect(scoreResponse.body.data.warnings[0]).toMatchObject({
      traitId: draftTrait.id,
      status: "DRAFT",
      reason: "Trait not Active"
    });
  });
});

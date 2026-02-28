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

describe("admin question CRUD contracts", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects question scoring guidance fields and supports CRUD without them", async () => {
    const suffix = Date.now().toString(36);
    const trait = await prisma.trait.create({
      data: {
        name: `Question Contract Trait ${suffix}`,
        category: "MOTIVATION"
      }
    });

    const app = createApp();

    const rejectedCreate = await request(app).post(`/api/admin/traits/${trait.id}/questions`).send({
      prompt: "Describe a project decision you made.",
      type: "chat",
      scoringHints: "legacy hints should be rejected"
    });
    expect(rejectedCreate.status).toBe(400);

    const created = await request(app).post(`/api/admin/traits/${trait.id}/questions`).send({
      prompt: "Describe a project decision you made.",
      type: "chat"
    });
    expect(created.status).toBe(201);
    expect(created.body.data.prompt).toBe("Describe a project decision you made.");
    expect(created.body.data.scoringHints).toBeUndefined();

    const questionId = created.body.data.id as string;
    const rejectedUpdate = await request(app).put(`/api/admin/questions/${questionId}`).send({
      scoringHints: "legacy update hints should be rejected"
    });
    expect(rejectedUpdate.status).toBe(400);

    const updated = await request(app).put(`/api/admin/questions/${questionId}`).send({
      prompt: "Describe how you validated your approach."
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.prompt).toBe("Describe how you validated your approach.");
    expect(updated.body.data.scoringHints).toBeUndefined();
  });
});

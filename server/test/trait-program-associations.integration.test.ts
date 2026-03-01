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

describe("trait-program association admin routes", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns programSummary count and topPrograms for traits list", async () => {
    const suffix = Date.now().toString(36);
    const trait = await prisma.trait.create({
      data: { name: `Assoc Trait ${suffix}`, category: "ACADEMIC" }
    });
    const programs = await Promise.all([
      prisma.program.create({ data: { name: `Program A ${suffix}`, isActive: true } }),
      prisma.program.create({ data: { name: `Program B ${suffix}`, isActive: true } }),
      prisma.program.create({ data: { name: `Program C ${suffix}`, isActive: true } }),
      prisma.program.create({ data: { name: `Program D ${suffix}`, isActive: true } })
    ]);

    await prisma.programTrait.createMany({
      data: [
        {
          programId: programs[0].id,
          traitId: trait.id,
          bucket: "CRITICAL",
          sortOrder: 0,
          notes: JSON.stringify({ weight: 0.4 })
        },
        {
          programId: programs[1].id,
          traitId: trait.id,
          bucket: "CRITICAL",
          sortOrder: 1,
          notes: JSON.stringify({ weight: 0.9 })
        },
        {
          programId: programs[2].id,
          traitId: trait.id,
          bucket: "IMPORTANT",
          sortOrder: 0,
          notes: JSON.stringify({ weight: 1.0 })
        },
        {
          programId: programs[3].id,
          traitId: trait.id,
          bucket: "VERY_IMPORTANT",
          sortOrder: 0,
          notes: JSON.stringify({ weight: 0.7 })
        }
      ]
    });

    const app = createApp();
    const response = await request(app).get("/api/admin/traits").query({ include: "programSummary", q: `Assoc Trait ${suffix}` });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    const item = response.body.data.find((row: { id: string }) => row.id === trait.id);
    expect(item?.programSummary?.count).toBe(4);
    expect(item?.programSummary?.topPrograms).toHaveLength(3);
    expect(item.programSummary.topPrograms[0].programId).toBe(programs[1].id);
    expect(item.programSummary.topPrograms[1].programId).toBe(programs[0].id);
    expect(item.programSummary.topPrograms[2].programId).toBe(programs[3].id);
  });

  it("adds, updates, lists, and removes trait-program associations", async () => {
    const suffix = Date.now().toString(36);
    const trait = await prisma.trait.create({
      data: { name: `Assoc CRUD Trait ${suffix}`, category: "INTERPERSONAL" }
    });
    const program = await prisma.program.create({
      data: { name: `Assoc CRUD Program ${suffix}`, isActive: true }
    });

    const app = createApp();
    const createResponse = await request(app).post(`/api/admin/traits/${trait.id}/programs`).send({
      programId: program.id,
      bucket: "IMPORTANT",
      weight: 0.55
    });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.programId).toBe(program.id);
    expect(createResponse.body.data.bucket).toBe("IMPORTANT");
    expect(createResponse.body.data.weight).toBeCloseTo(0.55, 2);

    const listResponse = await request(app).get(`/api/admin/traits/${trait.id}/programs`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].programId).toBe(program.id);

    const patchResponse = await request(app).patch(`/api/admin/traits/${trait.id}/programs/${program.id}`).send({
      bucket: "CRITICAL",
      weight: 0.8
    });
    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.data.bucket).toBe("CRITICAL");
    expect(patchResponse.body.data.weight).toBeCloseTo(0.8, 2);

    const deleteResponse = await request(app).delete(`/api/admin/traits/${trait.id}/programs/${program.id}`);
    expect(deleteResponse.status).toBe(200);

    const listAfterDelete = await request(app).get(`/api/admin/traits/${trait.id}/programs`);
    expect(listAfterDelete.status).toBe(200);
    expect(listAfterDelete.body.data).toHaveLength(0);
  });
});

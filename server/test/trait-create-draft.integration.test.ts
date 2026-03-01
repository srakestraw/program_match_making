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

describe("trait draft creation", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a DRAFT trait from minimal payload and returns id", async () => {
    const app = createApp();
    const response = await request(app).post("/api/admin/traits").send({});

    expect(response.status).toBe(201);
    expect(typeof response.body.data?.id).toBe("string");
    expect(response.body.data?.status).toBe("DRAFT");
    expect(String(response.body.data?.name ?? "")).toMatch(/^Untitled trait(?: \d+)?$/);
    expect(response.body.data?.category).toBe("ACADEMIC");

    const created = await prisma.trait.findUnique({ where: { id: response.body.data.id } });
    expect(created).not.toBeNull();
    expect(created?.status).toBe("DRAFT");
  });
});

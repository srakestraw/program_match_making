import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

let prisma: typeof import("../src/lib/prisma.js")["prisma"];
let createApp: typeof import("../src/app.js")["createApp"];

describe("program status admin routes", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("PATCH /api/admin/programs/:id/status updates isActive", async () => {
    const suffix = Date.now().toString(36);
    const program = await prisma.program.create({
      data: {
        name: `Program Status ${suffix}`,
        degreeLevel: "Masters",
        department: "Business",
        isActive: false
      }
    });

    const app = createApp();
    const response = await request(app).patch(`/api/admin/programs/${program.id}/status`).send({ isActive: true });

    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(true);

    const saved = await prisma.program.findUnique({ where: { id: program.id } });
    expect(saved?.isActive).toBe(true);
  });

  it("PATCH /api/admin/programs/:id accepts isActive and normalizes empty degreeLevel", async () => {
    const suffix = `${Date.now().toString(36)}-patch`;
    const program = await prisma.program.create({
      data: {
        name: `Program Patch ${suffix}`,
        degreeLevel: "Masters",
        department: "Business",
        isActive: true
      }
    });

    const app = createApp();
    const response = await request(app).patch(`/api/admin/programs/${program.id}`).send({
      degreeLevel: "   ",
      department: "  Analytics  ",
      isActive: false
    });

    expect(response.status).toBe(200);
    expect(response.body.data.degreeLevel).toBeNull();
    expect(response.body.data.department).toBe("Analytics");
    expect(response.body.data.isActive).toBe(false);
  });

  it("interview ranking excludes inactive programs", async () => {
    const suffix = `${Date.now().toString(36)}-ranking`;
    const [activeProgram, inactiveProgram] = await Promise.all([
      prisma.program.create({
        data: {
          name: `Ranking Active Program ${suffix}`,
          degreeLevel: "Masters",
          department: "Business",
          isActive: true
        }
      }),
      prisma.program.create({
        data: {
          name: `Ranking Inactive Program ${suffix}`,
          degreeLevel: "Masters",
          department: "Business",
          isActive: false
        }
      })
    ]);

    const trait = await prisma.trait.create({
      data: {
        name: `Ranking Trait ${suffix}`,
        category: "MOTIVATION",
        status: "ACTIVE"
      }
    });

    await prisma.traitQuestion.create({
      data: {
        traitId: trait.id,
        type: "CHAT",
        prompt: "Tell me about your goals."
      }
    });

    await prisma.programTrait.createMany({
      data: [
        { programId: activeProgram.id, traitId: trait.id, bucket: "CRITICAL", sortOrder: 0 },
        { programId: inactiveProgram.id, traitId: trait.id, bucket: "CRITICAL", sortOrder: 0 }
      ]
    });

    const previousNodeEnv = process.env.NODE_ENV;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.NODE_ENV = "production";

    try {
      const app = createApp();
      const response = await request(app).post("/api/interview/sessions").send({
        mode: "chat",
        programFilterIds: [activeProgram.id, inactiveProgram.id]
      });

      expect(response.status).toBe(201);
      expect(response.body.program_fit.programs.some((item: { programId: string }) => item.programId === inactiveProgram.id)).toBe(false);
      expect(response.body.program_fit.programs.some((item: { programId: string }) => item.programId === activeProgram.id)).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(inactiveProgram.id));
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

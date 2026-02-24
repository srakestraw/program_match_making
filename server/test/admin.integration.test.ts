import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// DATABASE_URL from .env (RDS PostgreSQL)

let prisma: typeof import("../src/lib/prisma.js")["prisma"];

describe("admin persistence integration", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates traits and program, saves bucket rows, and fetches ordered rows", async () => {
    const suffix = Date.now().toString(36);

    const traitOne = await prisma.trait.create({
      data: {
        name: `Integration Trait 1 ${suffix}`,
        category: "MOTIVATION",
        rubricScaleMin: 0,
        rubricScaleMax: 5
      }
    });

    const traitTwo = await prisma.trait.create({
      data: {
        name: `Integration Trait 2 ${suffix}`,
        category: "INTERPERSONAL",
        rubricScaleMin: 0,
        rubricScaleMax: 5
      }
    });

    const program = await prisma.program.create({
      data: {
        name: `Integration Program ${suffix}`,
        degreeLevel: "Graduate"
      }
    });

    await prisma.$transaction(async (tx) => {
      await tx.programTrait.deleteMany({ where: { programId: program.id } });
      await tx.programTrait.createMany({
        data: [
          { programId: program.id, traitId: traitTwo.id, bucket: "VERY_IMPORTANT", sortOrder: 0 },
          { programId: program.id, traitId: traitOne.id, bucket: "VERY_IMPORTANT", sortOrder: 1 }
        ]
      });
    });

    const rows = await prisma.programTrait.findMany({
      where: { programId: program.id },
      orderBy: [{ bucket: "asc" }, { sortOrder: "asc" }]
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.traitId).toBe(traitTwo.id);
    expect(rows[0]?.sortOrder).toBe(0);
    expect(rows[1]?.traitId).toBe(traitOne.id);
    expect(rows[1]?.sortOrder).toBe(1);
  });

});

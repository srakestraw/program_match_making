import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("program isActive migration", () => {
  it("adds Program.isActive with default false in Prisma schema", () => {
    const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
    const schema = fs.readFileSync(schemaPath, "utf8");
    expect(schema).toContain("isActive    Boolean        @default(false)");
  });

  it("backfills existing programs to active in SQL migration", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../prisma/migrations/20260228170500_program_is_active/migration.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain('ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;');
    expect(sql).toContain('UPDATE "Program"');
    expect(sql).toContain('SET "isActive" = true;');
  });
});

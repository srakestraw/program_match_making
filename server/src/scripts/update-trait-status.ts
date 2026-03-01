/**
 * Update trait status based on completeness.
 * Complete traits → ACTIVE; incomplete → DRAFT. DEPRECATED traits are left unchanged.
 *
 * Usage:
 *   pnpm --filter @pmm/server update-trait-status
 *   pnpm --filter @pmm/server update-trait-status --dry-run
 *
 * --dry-run  Log what would be updated without writing to the database.
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";
import { computeTraitCompleteness } from "../domain/traits/completeness.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

type TraitStatus = "DRAFT" | "IN_REVIEW" | "ACTIVE" | "DEPRECATED";

async function run() {
  if (DRY_RUN) {
    console.log("DRY RUN: no changes will be written.\n");
  }

  const traits = await prisma.trait.findMany({
    include: {
      _count: {
        select: { questions: true }
      }
    },
    orderBy: { name: "asc" }
  });

  console.log(`Found ${traits.length} traits.\n`);

  let updated = 0;
  let skippedDeprecated = 0;
  let unchanged = 0;

  for (const trait of traits) {
    const completeness = computeTraitCompleteness({
      name: trait.name,
      category: trait.category,
      definition: trait.definition,
      rubricPositiveSignals: trait.rubricPositiveSignals,
      rubricNegativeSignals: trait.rubricNegativeSignals,
      questionsCount: trait._count.questions
    });

    let targetStatus: TraitStatus;
    if (trait.status === "DEPRECATED") {
      targetStatus = trait.status;
      skippedDeprecated += 1;
      console.log(
        `  [skip deprecated] ${trait.name} | current: ${trait.status} | ${completeness.percentComplete}% complete`
      );
      continue;
    }

    targetStatus = completeness.isComplete ? "ACTIVE" : "DRAFT";

    if (trait.status === targetStatus) {
      unchanged += 1;
      console.log(
        `  [unchanged] ${trait.name} | ${trait.status} | ${completeness.percentComplete}% complete`
      );
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `  [dry-run] ${trait.name} | ${trait.status} → ${targetStatus} | ${completeness.percentComplete}% complete`
      );
      updated += 1;
      continue;
    }

    await prisma.trait.update({
      where: { id: trait.id },
      data: { status: targetStatus }
    });
    updated += 1;
    console.log(
      `  [updated] ${trait.name} | ${trait.status} → ${targetStatus} | ${completeness.percentComplete}% complete`
    );
  }

  console.log("\nDone.");
  console.log(`  Total traits: ${traits.length}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (deprecated): ${skippedDeprecated}`);
  console.log(`  Unchanged: ${unchanged}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

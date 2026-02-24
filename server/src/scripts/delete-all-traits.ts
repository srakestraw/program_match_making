/**
 * Deletes all traits and associated data (trait scores, program-trait links, trait questions).
 * Run: pnpm --filter @pmm/server delete-all-traits
 * Deletion order respects foreign keys.
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const traitScore = await prisma.traitScore.deleteMany({});
  const programTrait = await prisma.programTrait.deleteMany({});
  const traitQuestion = await prisma.traitQuestion.deleteMany({});
  const trait = await prisma.trait.deleteMany({});

  console.log("Deleted all trait and associated data:");
  console.log(`  TraitScore: ${traitScore.count}`);
  console.log(`  ProgramTrait: ${programTrait.count}`);
  console.log(`  TraitQuestion: ${traitQuestion.count}`);
  console.log(`  Trait: ${trait.count}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

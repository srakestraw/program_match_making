/**
 * Seed traits, programs, and program–trait assignments from seed-payloads.
 * Run: pnpm --filter @pmm/server seed:gsu-programs
 */
import { PrismaClient, ProgramTraitPriorityBucket, TraitCategory } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";
import { programTraitPlan, programsSeed, traitsSeed } from "./seed-payloads.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

const categoryMap: Record<string, TraitCategory> = {
  ACADEMIC: TraitCategory.ACADEMIC,
  INTERPERSONAL: TraitCategory.INTERPERSONAL,
  MOTIVATION: TraitCategory.MOTIVATION,
  EXPERIENCE: TraitCategory.EXPERIENCE,
  LEADERSHIP: TraitCategory.LEADERSHIP,
  PROBLEM_SOLVING: TraitCategory.PROBLEM_SOLVING
};

const bucketMap: Record<string, ProgramTraitPriorityBucket> = {
  CRITICAL: ProgramTraitPriorityBucket.CRITICAL,
  VERY_IMPORTANT: ProgramTraitPriorityBucket.VERY_IMPORTANT,
  IMPORTANT: ProgramTraitPriorityBucket.IMPORTANT,
  NICE_TO_HAVE: ProgramTraitPriorityBucket.NICE_TO_HAVE
};

async function run() {
  const traitIds = new Map<string, string>();
  const programIds = new Map<string, string>();

  for (const t of traitsSeed) {
    const category = categoryMap[t.category];
    if (!category) throw new Error(`Unknown trait category: ${t.category}`);
    const trait = await prisma.trait.upsert({
      where: { name: t.name },
      create: {
        name: t.name,
        category,
        definition: t.definition,
        rubricScaleMin: 0,
        rubricScaleMax: 5
      },
      update: { category, definition: t.definition }
    });
    traitIds.set(t.name, trait.id);
  }
  console.log(`Seeded ${traitIds.size} traits.`);

  for (const p of programsSeed) {
    const program = await prisma.program.upsert({
      where: { name: p.name },
      create: {
        name: p.name,
        description: p.description,
        degreeLevel: p.degreeLevel,
        department: p.department
      },
      update: {
        description: p.description,
        degreeLevel: p.degreeLevel,
        department: p.department
      }
    });
    programIds.set(p.name, program.id);
  }
  console.log(`Seeded ${programIds.size} programs.`);

  const programNamesFromPlan = [...new Set(programTraitPlan.map((r) => r.programName))];
  for (const programName of programNamesFromPlan) {
    const programId = programIds.get(programName);
    if (!programId) throw new Error(`Program not found: ${programName}`);
    await prisma.programTrait.deleteMany({ where: { programId } });
  }

  const programTraitData: { programId: string; traitId: string; bucket: ProgramTraitPriorityBucket; sortOrder: number; notes: string | null }[] = [];
  for (const row of programTraitPlan) {
    const programId = programIds.get(row.programName);
    const traitId = traitIds.get(row.traitName);
    if (!programId) throw new Error(`Program not found: ${row.programName}`);
    if (!traitId) throw new Error(`Trait not found: ${row.traitName}`);
    const bucket = bucketMap[row.bucket];
    if (!bucket) throw new Error(`Unknown bucket: ${row.bucket}`);
    programTraitData.push({
      programId,
      traitId,
      bucket,
      sortOrder: row.sortOrder,
      notes: row.notes
    });
  }

  await prisma.programTrait.createMany({ data: programTraitData });
  console.log(`Seeded ${programTraitData.length} program–trait links. Done.`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

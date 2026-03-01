/**
 * Seed traits, programs, and program–trait assignments from seed-payloads.
 * Traits get full rubric and 2 CHAT + 1 QUIZ questions so they are complete; status is set to ACTIVE.
 * Run: pnpm --filter @pmm/server seed:gsu-programs
 */
import {
  PrismaClient,
  ProgramTraitPriorityBucket,
  TraitCategory,
  TraitQuestionType,
  TraitStatus
} from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";
import { computeTraitCompleteness } from "../domain/traits/completeness.js";
import {
  buildTraitQuestionsSeed,
  defaultRubricForTrait,
  programTraitPlan,
  programsSeed,
  traitsSeed
} from "./seed-payloads.js";

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
    const { rubricPositiveSignals, rubricNegativeSignals, rubricFollowUps } = defaultRubricForTrait(t.definition);
    const trait = await prisma.trait.upsert({
      where: { name: t.name },
      create: {
        name: t.name,
        category,
        definition: t.definition,
        rubricScaleMin: 0,
        rubricScaleMax: 5,
        rubricPositiveSignals,
        rubricNegativeSignals,
        rubricFollowUps
      },
      update: {
        category,
        definition: t.definition,
        rubricScaleMin: 0,
        rubricScaleMax: 5,
        rubricPositiveSignals,
        rubricNegativeSignals,
        rubricFollowUps
      }
    });
    traitIds.set(t.name, trait.id);
  }
  console.log(`Seeded ${traitIds.size} traits.`);

  const questionSeed = buildTraitQuestionsSeed();
  for (const traitName of [...new Set(questionSeed.map((q) => q.traitName))]) {
    const traitId = traitIds.get(traitName)!;
    await prisma.traitQuestion.deleteMany({ where: { traitId } });
  }
  for (const q of questionSeed) {
    const traitId = traitIds.get(q.traitName);
    if (!traitId) throw new Error(`Trait not found: ${q.traitName}`);
    await prisma.traitQuestion.create({
      data: {
        traitId,
        type: q.type === "CHAT" ? TraitQuestionType.CHAT : TraitQuestionType.QUIZ,
        prompt: q.prompt,
        optionsJson: q.optionsJson ?? null
      }
    });
  }
  console.log(`Seeded ${questionSeed.length} trait questions (2 CHAT + 1 QUIZ per trait).`);

  for (const t of traitsSeed) {
    const traitId = traitIds.get(t.name)!;
    await prisma.trait.update({
      where: { id: traitId },
      data: { status: TraitStatus.ACTIVE }
    });
  }
  console.log(`Set all seeded traits to status ACTIVE.`);

  const seededTraits = await prisma.trait.findMany({
    where: { name: { in: traitsSeed.map((t) => t.name) } },
    include: { _count: { select: { questions: true } } },
    orderBy: { name: "asc" }
  });
  console.log("\n=== Trait status confirmation ===");
  let allActive = true;
  let allComplete = true;
  for (const trait of seededTraits) {
    const completeness = computeTraitCompleteness({
      name: trait.name,
      category: trait.category,
      definition: trait.definition,
      rubricPositiveSignals: trait.rubricPositiveSignals,
      rubricNegativeSignals: trait.rubricNegativeSignals,
      questionsCount: trait._count.questions
    });
    if (trait.status !== "ACTIVE") allActive = false;
    if (!completeness.isComplete) allComplete = false;
    console.log(
      `  ${trait.name.slice(0, 44).padEnd(44)} | status: ${trait.status.padEnd(9)} | complete: ${completeness.isComplete} | ${completeness.percentComplete}%`
    );
  }
  console.log(allActive && allComplete ? "\nPASS: All seeded traits are ACTIVE and complete." : "\nCheck: Some traits may need attention.");

  for (const p of programsSeed) {
    const program = await prisma.program.upsert({
      where: { name: p.name },
      create: {
        name: p.name,
        description: p.description,
        degreeLevel: p.degreeLevel,
        department: p.department,
        isActive: true
      },
      update: {
        description: p.description,
        degreeLevel: p.degreeLevel,
        department: p.department,
        isActive: true
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

/**
 * Seed traits, programs, and program–trait assignments from seed-payloads.
 * Traits get full rubric and 2 CHAT + 1 QUIZ questions so they are complete; status is set to ACTIVE.
 * Student-facing label fields are populated from AI-generated seed output when available.
 * Run: pnpm --filter @pmm/server seed:gsu-programs
 */
import {
  PrismaClient,
  ProgramTraitPriorityBucket,
  TraitCategory,
  TraitQuestionType,
  TraitStatus
} from "@prisma/client";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { computeTraitCompleteness } from "../domain/traits/completeness.js";
import { generateTraitExperienceDraft } from "../lib/traitContentGeneration.js";
import {
  buildTraitQuestionsSeed,
  defaultRubricForTrait,
  getSeedTraitExperience,
  programTraitPlan,
  programsSeed,
  traitsSeed
} from "./seed-payloads.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();
const repoRoot = path.resolve(process.cwd(), "..");
const generatedSeedPath = path.join(repoRoot, "docs", "seed", "seed.generated.json");
const aiCachePath = path.join(repoRoot, "docs", "seed", "ai-cache.generated.json");

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

type TraitExperienceSeed = {
  publicLabel: string;
  oneLineHook: string;
  archetypeTag: "ANALYST" | "BUILDER" | "STRATEGIST" | "OPERATOR" | "VISIONARY" | "LEADER" | "COMMUNICATOR";
  displayIcon: string;
  visualMood: "NEUTRAL" | "ASPIRATIONAL" | "PLAYFUL" | "BOLD" | "SERIOUS";
};

const isArchetype = (value: unknown): value is TraitExperienceSeed["archetypeTag"] =>
  typeof value === "string" && ["ANALYST", "BUILDER", "STRATEGIST", "OPERATOR", "VISIONARY", "LEADER", "COMMUNICATOR"].includes(value);

const isVisualMood = (value: unknown): value is TraitExperienceSeed["visualMood"] =>
  typeof value === "string" && ["NEUTRAL", "ASPIRATIONAL", "PLAYFUL", "BOLD", "SERIOUS"].includes(value);

const asNonEmpty = (value: unknown, fallback: string) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback);
const normalize = (value: string) => value.trim().toLowerCase();
const isGenericPublicLabel = (value: string | null | undefined, traitName: string) => {
  if (!value) return true;
  const normalized = normalize(value);
  if (normalized === normalize(traitName)) return true;
  return normalized.includes("&") || normalized.includes("reasoning") || normalized.includes("orientation");
};
const isGenericOneLineHook = (value: string | null | undefined) => {
  if (!value) return true;
  const normalized = normalize(value);
  return normalized.startsWith("show how you bring");
};

async function loadGeneratedTraitExperienceMap(): Promise<Map<string, Partial<TraitExperienceSeed>>> {
  try {
    const raw = await fs.readFile(generatedSeedPath, "utf8");
    const parsed = JSON.parse(raw) as { traitsSeed?: Array<Record<string, unknown>> };
    const map = new Map<string, Partial<TraitExperienceSeed>>();
    for (const trait of parsed.traitsSeed ?? []) {
      if (typeof trait.name !== "string" || !trait.name.trim()) continue;
      map.set(trait.name, {
        publicLabel: typeof trait.publicLabel === "string" ? trait.publicLabel : undefined,
        oneLineHook: typeof trait.oneLineHook === "string" ? trait.oneLineHook : undefined,
        archetypeTag: isArchetype(trait.archetypeTag) ? trait.archetypeTag : undefined,
        displayIcon: typeof trait.displayIcon === "string" ? trait.displayIcon : undefined,
        visualMood: isVisualMood(trait.visualMood) ? trait.visualMood : undefined
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

async function loadAiCacheTraitExperienceMap(): Promise<Map<string, Partial<TraitExperienceSeed>>> {
  try {
    const raw = await fs.readFile(aiCachePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    const map = new Map<string, Partial<TraitExperienceSeed>>();
    for (const [key, value] of Object.entries(parsed)) {
      map.set(key, {
        publicLabel: typeof value.publicLabel === "string" ? value.publicLabel : undefined,
        oneLineHook: typeof value.oneLineHook === "string" ? value.oneLineHook : undefined,
        archetypeTag: isArchetype(value.archetypeTag) ? value.archetypeTag : undefined,
        displayIcon: typeof value.displayIcon === "string" ? value.displayIcon : undefined,
        visualMood: isVisualMood(value.visualMood) ? value.visualMood : undefined
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

const makeAiCacheKey = (trait: { name: string; category: string; definition: string }) =>
  createHash("sha256").update(JSON.stringify(trait)).digest("hex");

async function resolveTraitExperienceSeed(
  trait: { name: string; category: string; definition: string },
  generated: Partial<TraitExperienceSeed> | undefined
): Promise<TraitExperienceSeed> {
  const fallback = getSeedTraitExperience(trait.name);
  if (generated) {
    return {
      publicLabel: isGenericPublicLabel(asNonEmpty(generated.publicLabel, fallback.publicLabel), trait.name)
        ? fallback.publicLabel
        : asNonEmpty(generated.publicLabel, fallback.publicLabel),
      oneLineHook: isGenericOneLineHook(asNonEmpty(generated.oneLineHook, fallback.oneLineHook))
        ? fallback.oneLineHook
        : asNonEmpty(generated.oneLineHook, fallback.oneLineHook),
      archetypeTag: isArchetype(generated.archetypeTag) ? generated.archetypeTag : fallback.archetypeTag,
      displayIcon: asNonEmpty(generated.displayIcon, fallback.displayIcon),
      visualMood: isVisualMood(generated.visualMood) ? generated.visualMood : fallback.visualMood
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    return await generateTraitExperienceDraft({
      action: "generate",
      name: trait.name,
      definition: trait.definition,
      category: trait.category
    });
  } catch (error) {
    console.warn(
      `Falling back to default student-facing label for "${trait.name}" (${error instanceof Error ? error.message : "AI generation error"}).`
    );
    return fallback;
  }
}

async function run() {
  const traitIds = new Map<string, string>();
  const programIds = new Map<string, string>();
  const generatedTraitExperienceMap = await loadGeneratedTraitExperienceMap();
  const aiCacheTraitExperienceMap = await loadAiCacheTraitExperienceMap();

  for (const t of traitsSeed) {
    const category = categoryMap[t.category];
    if (!category) throw new Error(`Unknown trait category: ${t.category}`);
    const { rubricPositiveSignals, rubricNegativeSignals, rubricFollowUps } = defaultRubricForTrait(t.definition);
    const generatedExperience = generatedTraitExperienceMap.get(t.name) ?? aiCacheTraitExperienceMap.get(makeAiCacheKey(t));
    const experience = await resolveTraitExperienceSeed(t, generatedExperience);
    const existing = await prisma.trait.findUnique({ where: { name: t.name } });
    const trait = existing
      ? await prisma.trait.update({
          where: { id: existing.id },
          data: {
            category,
            definition: t.definition,
            publicLabel: isGenericPublicLabel(existing.publicLabel, t.name) ? experience.publicLabel : existing.publicLabel,
            oneLineHook: isGenericOneLineHook(existing.oneLineHook) ? experience.oneLineHook : existing.oneLineHook,
            archetypeTag: existing.archetypeTag || experience.archetypeTag,
            displayIcon: existing.displayIcon || experience.displayIcon,
            visualMood: existing.visualMood || experience.visualMood,
            rubricScaleMin: 0,
            rubricScaleMax: 5,
            rubricPositiveSignals,
            rubricNegativeSignals,
            rubricFollowUps
          }
        })
      : await prisma.trait.create({
          data: {
            name: t.name,
            category,
            definition: t.definition,
            publicLabel: experience.publicLabel,
            oneLineHook: experience.oneLineHook,
            archetypeTag: experience.archetypeTag,
            displayIcon: experience.displayIcon,
            visualMood: experience.visualMood,
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
        narrativeIntro: q.narrativeIntro ?? null,
        optionsJson: q.optionsJson ?? null,
        answerOptionsMetaJson: q.answerOptionsMetaJson ?? null
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

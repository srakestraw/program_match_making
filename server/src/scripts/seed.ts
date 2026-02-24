import { PrismaClient, ProgramTraitPriorityBucket, TraitCategory, TraitQuestionType } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();
process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

const traitSeeds = [
  { name: "Motivation", category: TraitCategory.MOTIVATION },
  { name: "Communication", category: TraitCategory.INTERPERSONAL },
  { name: "Analytical Thinking", category: TraitCategory.PROBLEM_SOLVING },
  { name: "Leadership Potential", category: TraitCategory.LEADERSHIP },
  { name: "Resilience", category: TraitCategory.MOTIVATION },
  { name: "Teamwork", category: TraitCategory.INTERPERSONAL },
  { name: "Domain Experience", category: TraitCategory.EXPERIENCE },
  { name: "Academic Readiness", category: TraitCategory.ACADEMIC },
  { name: "Initiative", category: TraitCategory.LEADERSHIP },
  { name: "Problem Structuring", category: TraitCategory.PROBLEM_SOLVING }
];

const buckets: ProgramTraitPriorityBucket[] = [
  ProgramTraitPriorityBucket.CRITICAL,
  ProgramTraitPriorityBucket.VERY_IMPORTANT,
  ProgramTraitPriorityBucket.IMPORTANT,
  ProgramTraitPriorityBucket.NICE_TO_HAVE
];

const run = async () => {
  const traits = [] as Array<{ id: string; name: string }>;

  for (const traitSeed of traitSeeds) {
    const trait = await prisma.trait.upsert({
      where: { name: traitSeed.name },
      create: {
        name: traitSeed.name,
        category: traitSeed.category,
        definition: `${traitSeed.name} assessment trait.`,
        rubricScaleMin: 0,
        rubricScaleMax: 5
      },
      update: {
        category: traitSeed.category
      }
    });

    traits.push({ id: trait.id, name: trait.name });

    await prisma.traitQuestion.upsert({
      where: { id: `chat-${trait.id}` },
      create: {
        id: `chat-${trait.id}`,
        traitId: trait.id,
        type: TraitQuestionType.CHAT,
        prompt: `Tell us about an example that shows your ${trait.name.toLowerCase()}.`
      },
      update: {
        prompt: `Tell us about an example that shows your ${trait.name.toLowerCase()}.`
      }
    });

    await prisma.traitQuestion.upsert({
      where: { id: `quiz-${trait.id}` },
      create: {
        id: `quiz-${trait.id}`,
        traitId: trait.id,
        type: TraitQuestionType.QUIZ,
        prompt: `How strong is your ${trait.name.toLowerCase()}?`,
        optionsJson: JSON.stringify(["Low [1]", "Medium [3]", "High [5]"])
      },
      update: {
        prompt: `How strong is your ${trait.name.toLowerCase()}?`,
        optionsJson: JSON.stringify(["Low [1]", "Medium [3]", "High [5]"])
      }
    });
  }

  const programs = ["MBA Pilot Program", "Data Science Pilot Program"] as const;

  for (const programName of programs) {
    const program = await prisma.program.upsert({
      where: { name: programName },
      create: {
        name: programName,
        description: `${programName} seeded for local QA.`
      },
      update: {
        description: `${programName} seeded for local QA.`
      }
    });

    await prisma.programTrait.deleteMany({ where: { programId: program.id } });

    await prisma.programTrait.createMany({
      data: traits.map((trait, index) => ({
        programId: program.id,
        traitId: trait.id,
        bucket: buckets[index % buckets.length],
        sortOrder: Math.floor(index / buckets.length)
      }))
    });
  }

  await prisma.brandVoice.upsert({
    where: { name: "Pilot Default Voice" },
    create: {
      name: "Pilot Default Voice",
      tonePreset: "PROFESSIONAL",
      doList: "Be clear, concise, and encouraging.",
      dontList: "Avoid jargon and avoid overpromising.",
      samplePhrases: "Thanks for sharing that context."
    },
    update: {
      tonePreset: "PROFESSIONAL",
      doList: "Be clear, concise, and encouraging.",
      dontList: "Avoid jargon and avoid overpromising.",
      samplePhrases: "Thanks for sharing that context."
    }
  });

  console.log("Seed complete.");
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

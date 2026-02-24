import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();
// DATABASE_URL must be set (e.g. in .env) - RDS PostgreSQL

const prisma = new PrismaClient();

const seededTraitNames = [
  "Motivation",
  "Communication",
  "Analytical Thinking",
  "Leadership Potential",
  "Resilience",
  "Teamwork",
  "Domain Experience",
  "Academic Readiness",
  "Initiative",
  "Problem Structuring"
];

const seededProgramNames = ["MBA Pilot Program", "Data Science Pilot Program"];
const seededBrandVoiceNames = ["Pilot Default Voice"];

async function run() {
  const traitResult = await prisma.trait.deleteMany({
    where: {
      OR: [
        { name: { in: seededTraitNames } },
        { name: { startsWith: "Failure Trait " } },
        { name: { startsWith: "Integration Trait " } },
        { name: { startsWith: "Inbound SMS Trait " } }
      ]
    }
  });

  const programResult = await prisma.program.deleteMany({
    where: {
      OR: [
        { name: { in: seededProgramNames } },
        { name: { startsWith: "Failure Program " } },
        { name: { startsWith: "Integration Program " } }
      ]
    }
  });

  const brandVoiceResult = await prisma.brandVoice.deleteMany({
    where: {
      name: { in: seededBrandVoiceNames }
    }
  });

  console.log(
    `Deleted ${traitResult.count} mock traits, ${programResult.count} mock programs, and ${brandVoiceResult.count} mock brand voices.`
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

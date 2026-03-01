/**
 * Delete traits and programs created by integration tests (left in DB when tests don't clean up).
 * Run: pnpm --filter @pmm/server delete-integration-test-data
 *
 * Trait name prefixes (from test files):
 *   Lifecycle Incomplete, Lifecycle Review, Lifecycle Active, Lifecycle Draft,
 *   Quiz Trait A, Quiz Trait B, Admin Trait 1, Admin Trait 2,
 *   Lead Trait, Failure Trait, Phone Trait, Question Contract Trait,
 *   SMS Trait, Inbound SMS Trait
 * Program name prefixes:
 *   Lifecycle Program, Quiz Program, Admin Program, Lead Program,
 *   Failure Program, Phone Program, SMS Program, Inbound SMS Program
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

const TRAIT_NAME_PREFIXES = [
  "Lifecycle Incomplete ",
  "Lifecycle Review ",
  "Lifecycle Active ",
  "Lifecycle Draft ",
  "Quiz Trait A ",
  "Quiz Trait B ",
  "Admin Trait 1 ",
  "Admin Trait 2 ",
  "Lead Trait ",
  "Failure Trait ",
  "Phone Trait ",
  "Question Contract Trait ",
  "SMS Trait ",
  "Inbound SMS Trait "
];

const PROGRAM_NAME_PREFIXES = [
  "Lifecycle Program ",
  "Quiz Program ",
  "Admin Program ",
  "Lead Program ",
  "Failure Program ",
  "Phone Program ",
  "SMS Program ",
  "Inbound SMS Program "
];

async function run() {
  const testTraits = await prisma.trait.findMany({
    where: { OR: TRAIT_NAME_PREFIXES.map((p) => ({ name: { startsWith: p } })) },
    select: { id: true, name: true }
  });

  const testPrograms = await prisma.program.findMany({
    where: { OR: PROGRAM_NAME_PREFIXES.map((p) => ({ name: { startsWith: p } })) },
    select: { id: true, name: true }
  });

  const traitIds = testTraits.map((t) => t.id);
  const programIds = testPrograms.map((p) => p.id);

  if (traitIds.length === 0 && programIds.length === 0) {
    console.log("No integration-test traits or programs found. Nothing to delete.");
    return;
  }

  if (testTraits.length > 0) {
    console.log("Integration-test traits to delete:", testTraits.map((t) => t.name).join(", "));
  }
  if (testPrograms.length > 0) {
    console.log("Integration-test programs to delete:", testPrograms.map((p) => p.name).join(", "));
  }

  const scorecardIds = await prisma.scorecard.findMany({ where: { programId: { in: programIds } }, select: { id: true } }).then((r) => r.map((s) => s.id));

  const sessionIds = await prisma.candidateSession.findMany({ where: { programId: { in: programIds } }, select: { id: true } }).then((r) => r.map((s) => s.id));

  await prisma.traitScore.deleteMany({ where: { OR: [{ scorecardId: { in: scorecardIds } }, { traitId: { in: traitIds } }] } });
  await prisma.scorecard.deleteMany({ where: { programId: { in: programIds } } });
  await prisma.lead.deleteMany({ where: { programId: { in: programIds } } });
  await prisma.callSession.deleteMany({ where: { candidateSessionId: { in: sessionIds } } });
  await prisma.smsSession.deleteMany({ where: { candidateSessionId: { in: sessionIds } } });
  await prisma.transcriptTurn.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.candidateTraitScore.deleteMany({ where: { traitId: { in: traitIds } } });
  await prisma.candidateSession.deleteMany({ where: { programId: { in: programIds } } });
  await prisma.programTrait.deleteMany({ where: { OR: [{ programId: { in: programIds } }, { traitId: { in: traitIds } }] } });
  await prisma.traitQuestion.deleteMany({ where: { traitId: { in: traitIds } } });
  await prisma.trait.deleteMany({ where: { id: { in: traitIds } } });
  await prisma.program.deleteMany({ where: { id: { in: programIds } } });

  console.log(`Deleted ${testTraits.length} trait(s) and ${testPrograms.length} program(s).`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

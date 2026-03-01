/**
 * Remove traits and programs that are NOT part of the canonical seed (seed-payloads).
 * Keeps only traits in traitsSeed and programs in programsSeed; deletes all others.
 * Run: pnpm --filter @pmm/server cleanup-non-seed-traits-programs
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";
import { programsSeed, traitsSeed } from "./seed-payloads.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

const SEED_TRAIT_NAMES = new Set(traitsSeed.map((t) => t.name));
const SEED_PROGRAM_NAMES = new Set(programsSeed.map((p) => p.name));

async function run() {
  const allTraits = await prisma.trait.findMany({ select: { id: true, name: true } });
  const allPrograms = await prisma.program.findMany({ select: { id: true, name: true } });

  const nonSeedTraits = allTraits.filter((t) => !SEED_TRAIT_NAMES.has(t.name));
  const nonSeedPrograms = allPrograms.filter((p) => !SEED_PROGRAM_NAMES.has(p.name));

  const traitIds = nonSeedTraits.map((t) => t.id);
  const programIds = nonSeedPrograms.map((p) => p.id);

  if (traitIds.length === 0 && programIds.length === 0) {
    console.log("All traits and programs are in the seed. Nothing to delete.");
    return;
  }

  if (nonSeedTraits.length > 0) {
    console.log("Non-seed traits to delete:", nonSeedTraits.map((t) => t.name).join(", "));
  }
  if (nonSeedPrograms.length > 0) {
    console.log("Non-seed programs to delete:", nonSeedPrograms.map((p) => p.name).join(", "));
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

  console.log(`Deleted ${nonSeedTraits.length} non-seed trait(s) and ${nonSeedPrograms.length} non-seed program(s).`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

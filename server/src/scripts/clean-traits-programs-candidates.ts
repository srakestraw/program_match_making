/**
 * Deletes all trait, program, and candidate data. Keeps brand voice and related
 * (ConversationScenario, ConversationSimulation, ConversationTurn, VoiceSample).
 * Run: pnpm --filter @pmm/server clean-traits-programs-candidates
 * Deletion order respects foreign keys.
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const smsMessage = await prisma.smsMessage.deleteMany({});
  const callSession = await prisma.callSession.deleteMany({});
  const smsSession = await prisma.smsSession.deleteMany({});
  const traitScore = await prisma.traitScore.deleteMany({});
  const candidateTraitScore = await prisma.candidateTraitScore.deleteMany({});
  const scorecard = await prisma.scorecard.deleteMany({});
  const programTrait = await prisma.programTrait.deleteMany({});
  const traitQuestion = await prisma.traitQuestion.deleteMany({});
  const lead = await prisma.lead.deleteMany({});
  const transcriptTurn = await prisma.transcriptTurn.deleteMany({});
  const candidateSession = await prisma.candidateSession.deleteMany({});
  const trait = await prisma.trait.deleteMany({});
  const program = await prisma.program.deleteMany({});
  const candidate = await prisma.candidate.deleteMany({});

  console.log("Cleaned trait, program, and candidate data (brand voice kept). Deleted:");
  console.log(
    `  SmsMessage: ${smsMessage.count}, CallSession: ${callSession.count}, SmsSession: ${smsSession.count}`
  );
  console.log(
    `  TraitScore: ${traitScore.count}, CandidateTraitScore: ${candidateTraitScore.count}, Scorecard: ${scorecard.count}`
  );
  console.log(
    `  ProgramTrait: ${programTrait.count}, TraitQuestion: ${traitQuestion.count}, Lead: ${lead.count}`
  );
  console.log(
    `  TranscriptTurn: ${transcriptTurn.count}, CandidateSession: ${candidateSession.count}`
  );
  console.log(`  Trait: ${trait.count}, Program: ${program.count}, Candidate: ${candidate.count}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

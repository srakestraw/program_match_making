/**
 * One-time script: deletes all seeded and associated data so the DB starts from scratch.
 * Run: pnpm --filter @pmm/server reset-seed-data
 * Deletion order respects foreign keys.
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const voiceSample = await prisma.voiceSample.deleteMany({});
  const conversationTurn = await prisma.conversationTurn.deleteMany({});
  const conversationSimulation = await prisma.conversationSimulation.deleteMany({});
  const conversationScenario = await prisma.conversationScenario.deleteMany({});
  const smsMessage = await prisma.smsMessage.deleteMany({});
  const callSession = await prisma.callSession.deleteMany({});
  const smsSession = await prisma.smsSession.deleteMany({});
  const traitScore = await prisma.traitScore.deleteMany({});
  const scorecard = await prisma.scorecard.deleteMany({});
  const programTrait = await prisma.programTrait.deleteMany({});
  const traitQuestion = await prisma.traitQuestion.deleteMany({});
  const lead = await prisma.lead.deleteMany({});
  const transcriptTurn = await prisma.transcriptTurn.deleteMany({});
  const candidateSession = await prisma.candidateSession.deleteMany({});
  const trait = await prisma.trait.deleteMany({});
  const program = await prisma.program.deleteMany({});
  const brandVoice = await prisma.brandVoice.deleteMany({});
  const candidate = await prisma.candidate.deleteMany({});

  console.log("Reset complete. Deleted:");
  console.log(
    `  VoiceSample: ${voiceSample.count}, ConversationTurn: ${conversationTurn.count}, ConversationSimulation: ${conversationSimulation.count}, ConversationScenario: ${conversationScenario.count}`
  );
  console.log(
    `  SmsMessage: ${smsMessage.count}, CallSession: ${callSession.count}, SmsSession: ${smsSession.count}`
  );
  console.log(
    `  TraitScore: ${traitScore.count}, Scorecard: ${scorecard.count}, ProgramTrait: ${programTrait.count}`
  );
  console.log(
    `  TraitQuestion: ${traitQuestion.count}, Lead: ${lead.count}, TranscriptTurn: ${transcriptTurn.count}`
  );
  console.log(
    `  CandidateSession: ${candidateSession.count}, Trait: ${trait.count}, Program: ${program.count}`
  );
  console.log(`  BrandVoice: ${brandVoice.count}, Candidate: ${candidate.count}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

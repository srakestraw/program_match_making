/**
 * Seed the GSU Graduate School brand voice (graduate.gsu.edu).
 * Run: pnpm --filter @pmm/server seed:gsu-voice
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";
import { randomUUID } from "node:crypto";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

const VOICE_NAME = "GSU Graduate School";

const canonicalExamples = [
  { id: randomUUID(), type: "headline" as const, text: "An affordable R1 research university in the heart of Atlanta.", pinned: true },
  { id: randomUUID(), type: "cta" as const, text: "Start your application.", pinned: true },
  { id: randomUUID(), type: "email_intro" as const, text: "As a future graduate student, you can chart your own path with support at every stage of your journey.", pinned: true },
  { id: randomUUID(), type: "description" as const, text: "The Graduate School at Georgia State offers graduate degrees and certificates on campus and online, with scholarships, fellowships, and financial aid to support your goals.", pinned: true }
];

async function main() {
  const existing = await prisma.brandVoice.findFirst({ where: { name: VOICE_NAME } });
  if (existing) {
    console.log(`Brand voice "${VOICE_NAME}" already exists (id: ${existing.id}).`);
    return;
  }

  const voice = await prisma.brandVoice.create({
    data: {
      name: VOICE_NAME,
      primaryTone: "professional",
      toneModifiers: ["encouraging", "direct"],
      toneProfile: { formality: 78, warmth: 62, directness: 70, confidence: 72, energy: 58 },
      styleFlags: ["clear", "credible", "supportive", "future_focused", "outcome_oriented"],
      avoidFlags: ["jargon_heavy", "overly_salesy", "impersonal"],
      canonicalExamples
    }
  });

  console.log(`Created brand voice "${VOICE_NAME}" (id: ${voice.id}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

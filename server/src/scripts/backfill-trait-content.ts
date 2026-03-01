/**
 * Backfill trait rubric signals and questions using AI generation.
 * Requires OPENAI_API_KEY. Run after seed or when traits exist without signals/questions.
 *
 * Usage:
 *   pnpm --filter @pmm/server backfill-trait-content
 *   pnpm --filter @pmm/server backfill-trait-content --dry-run
 *
 * --dry-run  Log what would be updated/created without writing to the database.
 */
import { PrismaClient, TraitQuestionType } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";
import { generateTraitQuestions, generateTraitSignals } from "../lib/traitContentGeneration.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isEmpty(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === "";
}

async function run() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required. Set it in .env or the environment.");
  }

  if (DRY_RUN) {
    console.log("DRY RUN: no changes will be written.\n");
  }

  const traits = await prisma.trait.findMany({
    include: { questions: true },
    orderBy: { name: "asc" }
  });

  console.log(`Found ${traits.length} traits.\n`);

  let signalsUpdated = 0;
  let questionsCreated = 0;

  for (const trait of traits) {
    const needsSignals =
      isEmpty(trait.rubricPositiveSignals) || isEmpty(trait.rubricNegativeSignals);
    const needsQuestions = trait.questions.length === 0;

    if (!needsSignals && !needsQuestions) {
      console.log(`  [skip] ${trait.name} (already has signals and questions)`);
      continue;
    }

    if (needsSignals) {
      try {
        const data = await generateTraitSignals({
          name: trait.name,
          definition: trait.definition,
          category: trait.category
        });
        const positive = (data.positiveSignals ?? []).join("\n").trim() || null;
        const negative = (data.negativeSignals ?? []).join("\n").trim() || null;
        const followUps = (data.followUps ?? []).join("\n").trim() || null;

        if (DRY_RUN) {
          console.log(`  [dry-run] ${trait.name}: would set ${data.positiveSignals?.length ?? 0} positive, ${data.negativeSignals?.length ?? 0} negative signals`);
        } else {
          await prisma.trait.update({
            where: { id: trait.id },
            data: {
              rubricPositiveSignals: positive,
              rubricNegativeSignals: negative,
              rubricFollowUps: followUps
            }
          });
          signalsUpdated += 1;
          console.log(`  [signals] ${trait.name}`);
        }
        await delay(DELAY_MS);
      } catch (err) {
        console.error(`  [error] ${trait.name} (signals): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (needsQuestions) {
      try {
        const data = await generateTraitQuestions({
          name: trait.name,
          definition: trait.definition,
          category: trait.category
        });
        const chatPrompt = (data.chatPrompt ?? "").trim();
        const quizPrompt = (data.quizPrompt ?? "").trim();
        const quizOptions = Array.isArray(data.quizOptions) ? data.quizOptions.slice(0, 4) : [];

        if (DRY_RUN) {
          console.log(`  [dry-run] ${trait.name}: would add chat + quiz questions`);
        } else {
          if (chatPrompt) {
            await prisma.traitQuestion.create({
              data: {
                traitId: trait.id,
                type: TraitQuestionType.CHAT,
                prompt: chatPrompt
              }
            });
          }
          if (quizPrompt) {
            await prisma.traitQuestion.create({
              data: {
                traitId: trait.id,
                type: TraitQuestionType.QUIZ,
                prompt: quizPrompt,
                optionsJson: JSON.stringify(quizOptions)
              }
            });
          }
          questionsCreated += 1;
          console.log(`  [questions] ${trait.name}`);
        }
        await delay(DELAY_MS);
      } catch (err) {
        console.error(`  [error] ${trait.name} (questions): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log("\nDone.");
  if (!DRY_RUN) {
    console.log(`  Traits with signals updated: ${signalsUpdated}`);
    console.log(`  Traits with questions created: ${questionsCreated}`);
  }
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

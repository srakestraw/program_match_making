import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { fetchOpenAiWithRetry } from "../lib/openai.js";
import {
  CANONICAL_QUIZ_OPTIONS,
  generatedQuestionSeedSchema,
  generatedTraitSeedSchema,
  parseLines,
  programInputSchema,
  programTraitPlanRowSchema,
  traitInputSchema,
  validateSeedPayloads,
  type GeneratedQuestionSeed,
  type GeneratedTraitSeed,
  type ProgramInput,
  type ProgramTraitPlanRow,
  type TraitInput
} from "../lib/seed-generator.js";
import { programTraitPlan as fallbackPlan, programsSeed as fallbackPrograms, traitsSeed as fallbackTraits } from "./seed-payloads.js";

type TraitDraft = {
  positiveSignals: string[];
  negativeSignals: string[];
  followUps: string[];
  chatQuestions: string[];
  quizQuestion: string;
  publicLabel: string;
  oneLineHook: string;
  archetypeTag: "ANALYST" | "BUILDER" | "STRATEGIST" | "OPERATOR" | "VISIONARY" | "LEADER" | "COMMUNICATOR";
  displayIcon: string;
  visualMood: "NEUTRAL" | "ASPIRATIONAL" | "PLAYFUL" | "BOLD" | "SERIOUS";
};

type CacheShape = Record<string, TraitDraft>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const docsSeedDir = path.join(repoRoot, "docs", "seed");
const seedOutputPath = path.join(docsSeedDir, "seed.generated.json");
const validationOutputPath = path.join(docsSeedDir, "validation.generated.json");
const traitsExperienceOutputPath = path.join(docsSeedDir, "traitsExperience.generated.json");
const aiCachePath = path.join(docsSeedDir, "ai-cache.generated.json");

const requiredQuizOptionsJson = JSON.stringify(CANONICAL_QUIZ_OPTIONS);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseCli = () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const planPathArg = args.find((arg) => arg.startsWith("--plan="));
  const providedPlanPath = planPathArg ? planPathArg.slice("--plan=".length) : null;
  return { dryRun, providedPlanPath };
};

const defaultPlanPath = path.resolve("/mnt/data/seed-trait-progam.md");
const fallbackPlanPath = path.join(repoRoot, "docs", "seed-trait-progam.md");

const readFileIfExists = async (candidate: string) => {
  try {
    return await fs.readFile(candidate, "utf8");
  } catch {
    return null;
  }
};

const extractArray = (content: string, constName: string): unknown[] | null => {
  const pattern = new RegExp(`const\\s+${constName}\\s*=\\s*(\\[[\\s\\S]*?\\n\\]);`);
  const match = content.match(pattern);
  if (!match?.[1]) return null;
  const source = match[1];
  try {
    // Controlled local canonical file content.
    return Function(`"use strict"; return (${source});`)() as unknown[];
  } catch {
    return null;
  }
};

const loadCanonicalInputs = async (providedPlanPath?: string | null) => {
  const candidatePaths = [providedPlanPath, defaultPlanPath, fallbackPlanPath].filter((p): p is string => Boolean(p));
  let chosenPath: string | null = null;
  let content: string | null = null;

  for (const candidate of candidatePaths) {
    const text = await readFileIfExists(candidate);
    if (text) {
      chosenPath = candidate;
      content = text;
      break;
    }
  }

  if (!content || !chosenPath) {
    throw new Error(`Could not locate canonical planning file. Checked: ${candidatePaths.join(", ")}`);
  }

  const parsedTraits = extractArray(content, "traitsSeed");
  const parsedPrograms = extractArray(content, "programsSeed");
  const parsedPlan = extractArray(content, "programTraitPlan");

  const traits = (parsedTraits ?? fallbackTraits)
    .map((row) => traitInputSchema.parse(row))
    .map((row) => ({ ...row }));
  const programs = (parsedPrograms ?? fallbackPrograms)
    .map((row) => programInputSchema.parse(row))
    .map((row) => ({ ...row }));
  const programTraitPlan = (parsedPlan ?? fallbackPlan)
    .map((row) => programTraitPlanRowSchema.parse(row))
    .map((row) => ({ ...row }));

  return { chosenPath, content, traits, programs, programTraitPlan };
};

const makeCacheKey = (trait: TraitInput) => createHash("sha256").update(JSON.stringify(trait)).digest("hex");

const loadCache = async (): Promise<CacheShape> => {
  const content = await readFileIfExists(aiCachePath);
  if (!content) return {};
  try {
    const parsed = JSON.parse(content) as CacheShape;
    return parsed ?? {};
  } catch {
    return {};
  }
};

const saveCache = async (cache: CacheShape) => {
  await fs.mkdir(docsSeedDir, { recursive: true });
  await fs.writeFile(aiCachePath, JSON.stringify(cache, null, 2));
};

const fallbackDraft = (trait: TraitInput): TraitDraft => ({
  positiveSignals: [
    `Gives concrete examples showing ${trait.name.toLowerCase()}.`,
    "Explains decisions with clear, structured reasoning.",
    "Connects outcomes to measurable impact."
  ],
  negativeSignals: [
    `Cannot provide evidence of ${trait.name.toLowerCase()}.`,
    "Uses vague claims without specifics.",
    "Struggles to explain tradeoffs or impact."
  ],
  followUps: ["Ask for a specific example.", "Probe for measurable results."],
  chatQuestions: [
    `Tell me about a time you demonstrated ${trait.name.toLowerCase()} in a meaningful situation.`,
    `How have you used ${trait.name.toLowerCase()} to improve an outcome?`
  ],
  quizQuestion: `Which response best reflects strong ${trait.name.toLowerCase()}?`,
  publicLabel: trait.name,
  oneLineHook: `Show how you bring ${trait.name.toLowerCase()} to real decisions.`,
  archetypeTag: "ANALYST",
  displayIcon: "spark",
  visualMood: "ASPIRATIONAL"
});

const generateWithAi = async (trait: TraitInput): Promise<TraitDraft> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackDraft(trait);

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TRAIT_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Generate trait rubric + interview seed content. Return strict JSON matching schema. Keep wording concise and admissions-safe."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Trait: ${trait.name}\nCategory: ${trait.category}\nDefinition: ${trait.definition}\nRequirements: exactly 3 positive signals, exactly 3 negative signals, 0-2 follow-ups, 2 chat questions, 1 quiz question, plus public experience fields.`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "seed_trait_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              positiveSignals: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
              negativeSignals: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
              followUps: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 2 },
              chatQuestions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
              quizQuestion: { type: "string" },
              publicLabel: { type: "string" },
              oneLineHook: { type: "string" },
              archetypeTag: {
                type: "string",
                enum: ["ANALYST", "BUILDER", "STRATEGIST", "OPERATOR", "VISIONARY", "LEADER", "COMMUNICATOR"]
              },
              displayIcon: { type: "string" },
              visualMood: { type: "string", enum: ["NEUTRAL", "ASPIRATIONAL", "PLAYFUL", "BOLD", "SERIOUS"] }
            },
            required: [
              "positiveSignals",
              "negativeSignals",
              "followUps",
              "chatQuestions",
              "quizQuestion",
              "publicLabel",
              "oneLineHook",
              "archetypeTag",
              "displayIcon",
              "visualMood"
            ]
          }
        }
      }
    })
  });

  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    return fallbackDraft(trait);
  }

  try {
    const parsed = JSON.parse(String(payload.output_text ?? "{}")) as TraitDraft;
    if (!parsed || !Array.isArray(parsed.positiveSignals) || !Array.isArray(parsed.chatQuestions)) {
      return fallbackDraft(trait);
    }
    return {
      ...parsed,
      positiveSignals: parsed.positiveSignals.slice(0, 3),
      negativeSignals: parsed.negativeSignals.slice(0, 3),
      followUps: parsed.followUps.slice(0, 2),
      chatQuestions: parsed.chatQuestions.slice(0, 2)
    };
  } catch {
    return fallbackDraft(trait);
  }
};

const buildGeneratedPayloads = async (input: {
  traits: TraitInput[];
  programs: ProgramInput[];
  programTraitPlan: ProgramTraitPlanRow[];
}) => {
  const cache = await loadCache();
  const promptsUsed: string[] = [];

  const draftsByTrait = new Map<string, TraitDraft>();
  for (const trait of input.traits) {
    const key = makeCacheKey(trait);
    let draft = cache[key];
    if (!draft) {
      draft = await generateWithAi(trait);
      cache[key] = draft;
      await sleep(120);
    }
    promptsUsed.push(`trait:${trait.name}`);
    draftsByTrait.set(trait.name, draft);
  }

  await saveCache(cache);

  const traitsSeed: GeneratedTraitSeed[] = input.traits.map((trait) => {
    const draft = draftsByTrait.get(trait.name) ?? fallbackDraft(trait);
    return generatedTraitSeedSchema.parse({
      name: trait.name,
      category: trait.category,
      definition: trait.definition,
      status: "ACTIVE",
      rubricScaleMin: 0,
      rubricScaleMax: 5,
      rubricPositiveSignals: parseLines(draft.positiveSignals.join("\n"), 3, 3).join("\n"),
      rubricNegativeSignals: parseLines(draft.negativeSignals.join("\n"), 3, 3).join("\n"),
      rubricFollowUps: parseLines(draft.followUps.join("\n"), 0, 2).join("\n"),
      publicLabel: draft.publicLabel,
      oneLineHook: draft.oneLineHook,
      archetypeTag: draft.archetypeTag,
      displayIcon: draft.displayIcon,
      visualMood: draft.visualMood
    });
  });

  const traitQuestionsSeed: GeneratedQuestionSeed[] = input.traits.flatMap((trait) => {
    const draft = draftsByTrait.get(trait.name) ?? fallbackDraft(trait);
    return [
      generatedQuestionSeedSchema.parse({
        traitName: trait.name,
        type: "CHAT",
        narrativeIntro: trait.definition,
        answerStyle: "CHAT",
        questionText: draft.chatQuestions[0],
        prompt: draft.chatQuestions[0]
      }),
      generatedQuestionSeedSchema.parse({
        traitName: trait.name,
        type: "CHAT",
        narrativeIntro: trait.definition,
        answerStyle: "CHAT",
        questionText: draft.chatQuestions[1],
        prompt: draft.chatQuestions[1]
      }),
      generatedQuestionSeedSchema.parse({
        traitName: trait.name,
        type: "QUIZ",
        narrativeIntro: trait.definition,
        answerStyle: "CARD_GRID",
        questionText: draft.quizQuestion,
        prompt: draft.quizQuestion,
        optionsJson: requiredQuizOptionsJson,
        answerOptionsMeta: CANONICAL_QUIZ_OPTIONS.map((label, index) => ({
          label,
          microCopy:
            index === 0
              ? "Just getting started"
              : index === 1
              ? "Some reps, still growing"
              : index === 2
              ? "Reliable and consistent"
              : "Top-tier in real scenarios",
          iconToken: ["seedling", "wrench", "target", "crown"][index],
          traitScore: index + 1
        }))
      })
    ];
  });

  const report = validateSeedPayloads({
    traitsSeed,
    traitQuestionsSeed,
    programsSeed: input.programs,
    programTraitPlan: input.programTraitPlan
  });

  return {
    payload: {
      meta: {
        generatedAt: new Date().toISOString(),
        canonicalQuizOptions: CANONICAL_QUIZ_OPTIONS,
        promptsUsed
      },
      traitsSeed,
      traitQuestionsSeed,
      programsSeed: input.programs,
      programTraitPlan: input.programTraitPlan
    },
    traitsExperiencePayload: {
      meta: {
        generatedAt: new Date().toISOString(),
        promptsUsed
      },
      traitsExperienceSeed: input.traits.map((trait) => {
        const draft = draftsByTrait.get(trait.name) ?? fallbackDraft(trait);
        return {
          traitName: trait.name,
          displayName: draft.publicLabel,
          shortDescription: draft.oneLineHook,
          archetypeTag: draft.archetypeTag,
          displayIcon: draft.displayIcon,
          visualMood: draft.visualMood
        };
      })
    },
    report
  };
};

const run = async () => {
  const { dryRun, providedPlanPath } = parseCli();
  const canonical = await loadCanonicalInputs(providedPlanPath);
  const { payload, traitsExperiencePayload, report } = await buildGeneratedPayloads({
    traits: canonical.traits,
    programs: canonical.programs,
    programTraitPlan: canonical.programTraitPlan
  });

  if (dryRun) {
    console.log(`[seed:generate] Dry run complete using ${canonical.chosenPath}`);
    console.log(`[seed:generate] PASS=${report.pass}`);
    console.log(JSON.stringify(report.summary, null, 2));
    return;
  }

  await fs.mkdir(docsSeedDir, { recursive: true });
  await fs.writeFile(seedOutputPath, JSON.stringify(payload, null, 2));
  await fs.writeFile(validationOutputPath, JSON.stringify(report, null, 2));
  await fs.writeFile(traitsExperienceOutputPath, JSON.stringify(traitsExperiencePayload, null, 2));

  console.log(`[seed:generate] Wrote ${seedOutputPath}`);
  console.log(`[seed:generate] Wrote ${validationOutputPath}`);
  console.log(`[seed:generate] Wrote ${traitsExperienceOutputPath}`);
  console.log(`[seed:generate] PASS=${report.pass}`);

  if (!report.pass) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error("[seed:generate] failed", error instanceof Error ? error.message : error);
  process.exit(1);
});

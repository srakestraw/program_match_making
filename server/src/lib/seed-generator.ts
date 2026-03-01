import { z } from "zod";

export const CANONICAL_QUIZ_OPTIONS = ["Beginner", "Developing", "Proficient", "Advanced"] as const;

export const traitCategorySchema = z.enum([
  "ACADEMIC",
  "INTERPERSONAL",
  "MOTIVATION",
  "EXPERIENCE",
  "LEADERSHIP",
  "PROBLEM_SOLVING"
]);

export const bucketSchema = z.enum(["CRITICAL", "VERY_IMPORTANT", "IMPORTANT", "NICE_TO_HAVE"]);

export const archetypeTagSchema = z.enum([
  "ANALYST",
  "BUILDER",
  "STRATEGIST",
  "OPERATOR",
  "VISIONARY",
  "LEADER",
  "COMMUNICATOR"
]);

export const traitInputSchema = z.object({
  name: z.string().min(1),
  category: traitCategorySchema,
  definition: z.string().min(1)
});

export const programInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  degreeLevel: z.string().nullable().optional(),
  department: z.string().nullable().optional()
});

export const programTraitPlanRowSchema = z.object({
  programName: z.string().min(1),
  traitName: z.string().min(1),
  bucket: bucketSchema,
  sortOrder: z.number().int().positive(),
  notes: z.string().nullable().optional()
});

export const generatedTraitSeedSchema = z.object({
  name: z.string().min(1),
  category: traitCategorySchema,
  definition: z.string().min(1),
  status: z.enum(["DRAFT", "IN_REVIEW", "ACTIVE", "DEPRECATED"]).default("ACTIVE"),
  rubricScaleMin: z.literal(0),
  rubricScaleMax: z.literal(5),
  rubricPositiveSignals: z.string().min(1),
  rubricNegativeSignals: z.string().min(1),
  rubricFollowUps: z.string().optional().default(""),
  publicLabel: z.string().optional(),
  oneLineHook: z.string().optional(),
  archetypeTag: archetypeTagSchema.optional(),
  displayIcon: z.string().optional(),
  visualMood: z.enum(["NEUTRAL", "ASPIRATIONAL", "PLAYFUL", "BOLD", "SERIOUS"]).optional()
});

export const generatedQuestionSeedSchema = z.object({
  traitName: z.string().min(1),
  type: z.enum(["CHAT", "QUIZ"]),
  narrativeIntro: z.string().optional(),
  questionText: z.string().min(1),
  answerStyle: z.enum(["RADIO", "CARD_GRID", "SLIDER", "CHAT"]).optional(),
  prompt: z.string().min(1),
  optionsJson: z.string().optional(),
  answerOptionsMeta: z
    .array(
      z.object({
        label: z.string(),
        microCopy: z.string().optional(),
        iconToken: z.string().optional(),
        traitScore: z.number().min(0).max(5).optional()
      })
    )
    .optional()
});

export const validationReportSchema = z.object({
  pass: z.boolean(),
  checks: z.object({
    bucketCountsByProgram: z.array(
      z.object({
        programName: z.string(),
        counts: z.object({
          CRITICAL: z.number().int(),
          VERY_IMPORTANT: z.number().int(),
          IMPORTANT: z.number().int(),
          NICE_TO_HAVE: z.number().int()
        }),
        total: z.number().int(),
        pass: z.boolean()
      })
    ),
    duplicateTraitNames: z.array(z.string()),
    duplicateProgramTraitPairs: z.array(z.string()),
    traitUsageFrequency: z.array(z.object({ traitName: z.string(), count: z.number().int() })),
    traitsUsedOnce: z.array(z.string()),
    questionCountByTrait: z.array(
      z.object({
        traitName: z.string(),
        chatCount: z.number().int(),
        quizCount: z.number().int(),
        pass: z.boolean()
      })
    )
  }),
  summary: z.array(z.string())
});

export type TraitInput = z.infer<typeof traitInputSchema>;
export type ProgramInput = z.infer<typeof programInputSchema>;
export type ProgramTraitPlanRow = z.infer<typeof programTraitPlanRowSchema>;
export type GeneratedTraitSeed = z.infer<typeof generatedTraitSeedSchema>;
export type GeneratedQuestionSeed = z.infer<typeof generatedQuestionSeedSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;

export const parseLines = (raw: string, expectedMin: number, expectedMax: number): string[] => {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < expectedMin) {
    return [...lines, ...Array.from({ length: expectedMin - lines.length }, (_, i) => `Placeholder ${i + 1}`)];
  }
  if (lines.length > expectedMax) {
    return lines.slice(0, expectedMax);
  }
  return lines;
};

export const validateSeedPayloads = (input: {
  traitsSeed: GeneratedTraitSeed[];
  traitQuestionsSeed: GeneratedQuestionSeed[];
  programsSeed: ProgramInput[];
  programTraitPlan: ProgramTraitPlanRow[];
}): ValidationReport => {
  const summary: string[] = [];

  const byProgram = new Map<string, { CRITICAL: number; VERY_IMPORTANT: number; IMPORTANT: number; NICE_TO_HAVE: number }>();
  for (const row of input.programTraitPlan) {
    const current = byProgram.get(row.programName) ?? { CRITICAL: 0, VERY_IMPORTANT: 0, IMPORTANT: 0, NICE_TO_HAVE: 0 };
    current[row.bucket] += 1;
    byProgram.set(row.programName, current);
  }

  const bucketCountsByProgram = [...byProgram.entries()].map(([programName, counts]) => {
    const total = counts.CRITICAL + counts.VERY_IMPORTANT + counts.IMPORTANT + counts.NICE_TO_HAVE;
    const pass =
      counts.CRITICAL === 2 &&
      counts.VERY_IMPORTANT === 1 &&
      counts.IMPORTANT === 1 &&
      counts.NICE_TO_HAVE === 1 &&
      total === 5;
    return { programName, counts, total, pass };
  });

  const traitNames = input.traitsSeed.map((t) => t.name.trim().toLowerCase());
  const duplicateTraitNames = [...new Set(traitNames.filter((name, idx) => traitNames.indexOf(name) !== idx))];

  const pairKeys = input.programTraitPlan.map((row) => `${row.programName}::${row.traitName}`);
  const duplicateProgramTraitPairs = [...new Set(pairKeys.filter((name, idx) => pairKeys.indexOf(name) !== idx))];

  const usageMap = new Map<string, number>();
  for (const row of input.programTraitPlan) {
    usageMap.set(row.traitName, (usageMap.get(row.traitName) ?? 0) + 1);
  }
  const traitUsageFrequency = [...usageMap.entries()]
    .map(([traitName, count]) => ({ traitName, count }))
    .sort((a, b) => a.traitName.localeCompare(b.traitName));
  const traitsUsedOnce = traitUsageFrequency.filter((row) => row.count === 1).map((row) => row.traitName);

  const questionCountByTrait = input.traitsSeed.map((trait) => {
    const rows = input.traitQuestionsSeed.filter((q) => q.traitName === trait.name);
    const chatCount = rows.filter((q) => q.type === "CHAT").length;
    const quizCount = rows.filter((q) => q.type === "QUIZ").length;
    return {
      traitName: trait.name,
      chatCount,
      quizCount,
      pass: chatCount === 2 && quizCount === 1
    };
  });

  const pass =
    bucketCountsByProgram.every((row) => row.pass) &&
    duplicateTraitNames.length === 0 &&
    duplicateProgramTraitPairs.length === 0 &&
    questionCountByTrait.every((row) => row.pass);

  summary.push(pass ? "PASS" : "FAIL");
  if (traitsUsedOnce.length > 0) {
    summary.push(`Traits used once: ${traitsUsedOnce.join(", ")}`);
  }

  return {
    pass,
    checks: {
      bucketCountsByProgram,
      duplicateTraitNames,
      duplicateProgramTraitPairs,
      traitUsageFrequency,
      traitsUsedOnce,
      questionCountByTrait
    },
    summary
  };
};

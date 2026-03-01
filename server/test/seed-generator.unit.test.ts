import { describe, expect, it } from "vitest";
import {
  generatedQuestionSeedSchema,
  generatedTraitSeedSchema,
  validateSeedPayloads,
  type GeneratedQuestionSeed,
  type GeneratedTraitSeed,
  type ProgramInput,
  type ProgramTraitPlanRow
} from "../src/lib/seed-generator.js";

const traitsSeed: GeneratedTraitSeed[] = [
  generatedTraitSeedSchema.parse({
    name: "Analytical & Quantitative Reasoning",
    category: "PROBLEM_SOLVING",
    definition: "Breaks down complex problems.",
    status: "ACTIVE",
    rubricScaleMin: 0,
    rubricScaleMax: 5,
    rubricPositiveSignals: "A\nB\nC",
    rubricNegativeSignals: "X\nY\nZ",
    rubricFollowUps: "F1"
  }),
  generatedTraitSeedSchema.parse({
    name: "Data Analytics & Visualization",
    category: "ACADEMIC",
    definition: "Turns data into insights.",
    status: "ACTIVE",
    rubricScaleMin: 0,
    rubricScaleMax: 5,
    rubricPositiveSignals: "A\nB\nC",
    rubricNegativeSignals: "X\nY\nZ",
    rubricFollowUps: "F1"
  }),
  generatedTraitSeedSchema.parse({
    name: "Stakeholder Communication",
    category: "INTERPERSONAL",
    definition: "Communicates with stakeholders.",
    status: "ACTIVE",
    rubricScaleMin: 0,
    rubricScaleMax: 5,
    rubricPositiveSignals: "A\nB\nC",
    rubricNegativeSignals: "X\nY\nZ",
    rubricFollowUps: "F1"
  }),
  generatedTraitSeedSchema.parse({
    name: "Strategic Business Acumen",
    category: "LEADERSHIP",
    definition: "Connects decisions to strategy.",
    status: "ACTIVE",
    rubricScaleMin: 0,
    rubricScaleMax: 5,
    rubricPositiveSignals: "A\nB\nC",
    rubricNegativeSignals: "X\nY\nZ",
    rubricFollowUps: "F1"
  }),
  generatedTraitSeedSchema.parse({
    name: "Innovation & Entrepreneurial Drive",
    category: "MOTIVATION",
    definition: "Drives experimentation.",
    status: "ACTIVE",
    rubricScaleMin: 0,
    rubricScaleMax: 5,
    rubricPositiveSignals: "A\nB\nC",
    rubricNegativeSignals: "X\nY\nZ",
    rubricFollowUps: "F1"
  }),
  generatedTraitSeedSchema.parse({
    name: "Financial Decision-Making",
    category: "ACADEMIC",
    definition: "Evaluates financial tradeoffs.",
    status: "ACTIVE",
    rubricScaleMin: 0,
    rubricScaleMax: 5,
    rubricPositiveSignals: "A\nB\nC",
    rubricNegativeSignals: "X\nY\nZ",
    rubricFollowUps: "F1"
  })
];

const programsSeed: ProgramInput[] = [{ name: "MBA", description: null, degreeLevel: "MBA", department: "Robinson" }];

const programTraitPlan: ProgramTraitPlanRow[] = [
  { programName: "MBA", traitName: "Analytical & Quantitative Reasoning", bucket: "CRITICAL", sortOrder: 1, notes: null },
  { programName: "MBA", traitName: "Data Analytics & Visualization", bucket: "CRITICAL", sortOrder: 2, notes: null },
  { programName: "MBA", traitName: "Stakeholder Communication", bucket: "VERY_IMPORTANT", sortOrder: 1, notes: null },
  { programName: "MBA", traitName: "Strategic Business Acumen", bucket: "IMPORTANT", sortOrder: 1, notes: null },
  { programName: "MBA", traitName: "Innovation & Entrepreneurial Drive", bucket: "NICE_TO_HAVE", sortOrder: 1, notes: null }
];

const buildQuestions = (broken = false): GeneratedQuestionSeed[] => {
  const rows: GeneratedQuestionSeed[] = [];
  for (const trait of traitsSeed) {
    rows.push(
      generatedQuestionSeedSchema.parse({
        traitName: trait.name,
        type: "CHAT",
        prompt: `${trait.name} chat 1`,
        questionText: `${trait.name} chat 1`,
        answerStyle: "CHAT"
      }),
      generatedQuestionSeedSchema.parse({
        traitName: trait.name,
        type: "CHAT",
        prompt: `${trait.name} chat 2`,
        questionText: `${trait.name} chat 2`,
        answerStyle: "CHAT"
      }),
      generatedQuestionSeedSchema.parse({
        traitName: trait.name,
        type: "QUIZ",
        prompt: `${trait.name} quiz`,
        questionText: `${trait.name} quiz`,
        answerStyle: "CARD_GRID",
        optionsJson: '["Beginner","Developing","Proficient","Advanced"]'
      })
    );
  }
  if (broken) {
    return rows.filter((row) => !(row.traitName === "Financial Decision-Making" && row.type === "QUIZ"));
  }
  return rows;
};

describe("seed-generator validator", () => {
  it("passes with valid bucket and question counts", () => {
    const report = validateSeedPayloads({
      traitsSeed,
      traitQuestionsSeed: buildQuestions(false),
      programsSeed,
      programTraitPlan
    });

    expect(report.pass).toBe(true);
    expect(report.checks.bucketCountsByProgram[0]?.pass).toBe(true);
    expect(report.checks.duplicateProgramTraitPairs.length).toBe(0);
  });

  it("fails when trait question counts are wrong", () => {
    const report = validateSeedPayloads({
      traitsSeed,
      traitQuestionsSeed: buildQuestions(true),
      programsSeed,
      programTraitPlan
    });

    expect(report.pass).toBe(false);
    expect(report.checks.questionCountByTrait.some((row) => row.pass === false)).toBe(true);
  });
});

import { ProgramTraitPriorityBucket } from "@prisma/client";
import { prisma } from "./prisma.js";
import { filterActivePrograms } from "./program-activity.js";

export type SnapshotConfidence = "low" | "medium" | "high" | null;

export type SnapshotTrait = {
  traitId: string;
  traitName: string;
  score_1_to_5: number | null;
  confidence: SnapshotConfidence;
  evidence: string[];
  rationale: string | null;
  status: "unanswered" | "active" | "complete";
};

export type ScoringSnapshot = {
  traits: SnapshotTrait[];
};

export type ProgramFit = {
  programs: Array<{
    programId: string;
    programName: string;
    fitScore_0_to_100: number;
    topTraits: Array<{ traitName: string; delta: number }>;
  }>;
  selectedProgramId: string | null;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const bucketToFitWeight = (bucket: ProgramTraitPriorityBucket): number => {
  if (bucket === "CRITICAL") return 3;
  if (bucket === "VERY_IMPORTANT") return 2.5;
  if (bucket === "IMPORTANT") return 2;
  return 1;
};

const confidenceMultiplier = (confidence: SnapshotConfidence, answered: boolean) => {
  if (!answered) return 0.8;
  if (confidence === "low") return 0.85;
  if (confidence === "medium") return 0.95;
  return 1;
};

const normalizeScore = (value: number | null) => {
  if (value === null) return 0.5;
  return clamp((value - 1) / 4, 0, 1);
};

export const computeProgramFitFromData = (input: {
  programs: Array<{
    id: string;
    name: string;
    traits: Array<{ traitId: string; bucket: ProgramTraitPriorityBucket; trait: { name: string } }>;
  }>;
  snapshot: ScoringSnapshot;
  selectedProgramId: string | null;
  limit?: number;
}): ProgramFit => {
  const scoreByTrait = new Map(input.snapshot.traits.map((trait) => [trait.traitId, trait]));

  const scored = input.programs.map((program) => {
    let achieved = 0;
    let totalWeight = 0;

    const deltas = program.traits.map((programTrait) => {
      const traitScore = scoreByTrait.get(programTrait.traitId);
      const weight = bucketToFitWeight(programTrait.bucket);
      const answered = traitScore?.score_1_to_5 !== null;
      const norm = normalizeScore(traitScore?.score_1_to_5 ?? null);
      const multiplier = confidenceMultiplier(traitScore?.confidence ?? null, answered);

      totalWeight += weight;
      achieved += weight * norm * multiplier;

      return {
        traitName: traitScore?.traitName ?? programTrait.trait.name,
        delta: Number((weight * (norm - 0.5)).toFixed(3))
      };
    });

    const fit = totalWeight > 0 ? (achieved / totalWeight) * 100 : 0;

    return {
      programId: program.id,
      programName: program.name,
      fitScore_0_to_100: Number(fit.toFixed(2)),
      topTraits: deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3)
    };
  });

  const ordered = scored.sort((a, b) => {
    if (b.fitScore_0_to_100 !== a.fitScore_0_to_100) {
      return b.fitScore_0_to_100 - a.fitScore_0_to_100;
    }
    return a.programName.localeCompare(b.programName);
  });

  const rawLimit = input.limit ?? Number(process.env.PROGRAM_FLOAT_LIMIT ?? 8);
  const limit = clamp(Number.isFinite(rawLimit) ? rawLimit : 8, 3, 8);
  let limited = ordered.slice(0, limit);

  if (input.selectedProgramId && !limited.some((item) => item.programId === input.selectedProgramId)) {
    const selected = ordered.find((item) => item.programId === input.selectedProgramId);
    if (selected) {
      limited = [...limited.slice(0, Math.max(0, limit - 1)), selected];
    }
  }

  return {
    programs: limited,
    selectedProgramId: input.selectedProgramId
  };
};

export const computeProgramFit = async (sessionId: string, snapshot: ScoringSnapshot): Promise<ProgramFit> => {
  const session = await prisma.candidateSession.findUnique({
    where: { id: sessionId },
    include: { program: true }
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const scopedPrograms = await prisma.program.findMany({
    where: session.program?.department ? { department: session.program.department } : undefined,
    include: {
      traits: {
        include: {
          trait: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    take: 24
  });

  const scopedActivePrograms = filterActivePrograms(scopedPrograms, {
    context: `computeProgramFit:session:${sessionId}:department-scope`
  });

  const allPrograms =
    scopedActivePrograms.length > 0
      ? scopedActivePrograms
      : filterActivePrograms(
          await prisma.program.findMany({
            include: {
              traits: {
                include: {
                  trait: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            },
            orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
            take: 24
          }),
          { context: `computeProgramFit:session:${sessionId}:global-scope` }
        );

  const selectedProgramId = allPrograms.some((program) => program.id === session.programId) ? session.programId : null;

  return computeProgramFitFromData({
    programs: allPrograms.map((program) => ({
      id: program.id,
      name: program.name,
      traits: program.traits.map((trait) => ({
        traitId: trait.traitId,
        bucket: trait.bucket,
        trait: { name: trait.trait.name }
      }))
    })),
    snapshot,
    selectedProgramId
  });
};

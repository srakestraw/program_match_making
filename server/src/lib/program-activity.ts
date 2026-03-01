type MatchmakingProgram = {
  id: string;
  name: string;
  isActive: boolean;
};

const formatProgramList = (programs: MatchmakingProgram[]) =>
  programs.map((program) => `${program.id} (${program.name})`).join(", ");

const shouldThrowForInactive = () => process.env.NODE_ENV === "development";

export const assertAllProgramsActive = (
  programs: MatchmakingProgram[],
  options: { context?: string } = {}
): void => {
  const inactivePrograms = programs.filter((program) => !program.isActive);
  if (inactivePrograms.length === 0) {
    return;
  }

  const prefix = options.context ? `[${options.context}] ` : "";
  const message = `${prefix}Inactive programs detected and excluded from matchmaking: ${formatProgramList(inactivePrograms)}`;

  if (shouldThrowForInactive()) {
    throw new Error(message);
  }

  console.warn(message);
};

export const filterActivePrograms = <T extends MatchmakingProgram>(
  programs: T[],
  options: { context?: string } = {}
): T[] => {
  assertAllProgramsActive(programs, options);
  return programs.filter((program) => program.isActive);
};

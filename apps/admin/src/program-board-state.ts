import { ProgramTraitPriorityBucket, programTraitPriorityBuckets } from "@pmm/domain";

export type BoardTrait = {
  id: string;
  name: string;
  category: string;
};

export type ProgramBoardState = Record<ProgramTraitPriorityBucket, BoardTrait[]>;

export const createEmptyProgramBoardState = (): ProgramBoardState => ({
  CRITICAL: [],
  VERY_IMPORTANT: [],
  IMPORTANT: [],
  NICE_TO_HAVE: []
});

export const moveTraitInBoard = (
  board: ProgramBoardState,
  fromBucket: ProgramTraitPriorityBucket,
  fromIndex: number,
  toBucket: ProgramTraitPriorityBucket,
  toIndex?: number
): ProgramBoardState => {
  const source = [...board[fromBucket]];
  const [moved] = source.splice(fromIndex, 1);
  if (!moved) {
    return board;
  }

  const destination = fromBucket === toBucket ? source : [...board[toBucket]];
  const insertIndex = toIndex === undefined ? destination.length : toIndex;
  destination.splice(insertIndex, 0, moved);

  return {
    ...board,
    [fromBucket]: source,
    [toBucket]: destination
  };
};

export const removeTraitFromBoard = (
  board: ProgramBoardState,
  traitId: string
): { nextBoard: ProgramBoardState; removed: boolean } => {
  let removed = false;
  const next = createEmptyProgramBoardState();

  for (const bucket of programTraitPriorityBuckets) {
    const previous = board[bucket];
    next[bucket] = previous.filter((trait) => {
      const shouldKeep = trait.id !== traitId;
      if (!shouldKeep) {
        removed = true;
      }
      return shouldKeep;
    });
  }

  return { nextBoard: next, removed };
};

export const toBoardIdState = (board: ProgramBoardState): Record<ProgramTraitPriorityBucket, string[]> => ({
  CRITICAL: board.CRITICAL.map((trait) => trait.id),
  VERY_IMPORTANT: board.VERY_IMPORTANT.map((trait) => trait.id),
  IMPORTANT: board.IMPORTANT.map((trait) => trait.id),
  NICE_TO_HAVE: board.NICE_TO_HAVE.map((trait) => trait.id)
});

const boardSignature = (board: ProgramBoardState): string =>
  programTraitPriorityBuckets.map((bucket) => `${bucket}:${board[bucket].map((trait) => trait.id).join(",")}`).join("|");

export const isBoardDirty = (board: ProgramBoardState, savedBoard: ProgramBoardState): boolean =>
  boardSignature(board) !== boardSignature(savedBoard);

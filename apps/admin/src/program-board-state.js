import { programTraitPriorityBuckets } from "@pmm/domain";
export const createEmptyProgramBoardState = () => ({
    CRITICAL: [],
    VERY_IMPORTANT: [],
    IMPORTANT: [],
    NICE_TO_HAVE: []
});
export const moveTraitInBoard = (board, fromBucket, fromIndex, toBucket, toIndex) => {
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
export const removeTraitFromBoard = (board, traitId) => {
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
export const toBoardIdState = (board) => ({
    CRITICAL: board.CRITICAL.map((trait) => trait.id),
    VERY_IMPORTANT: board.VERY_IMPORTANT.map((trait) => trait.id),
    IMPORTANT: board.IMPORTANT.map((trait) => trait.id),
    NICE_TO_HAVE: board.NICE_TO_HAVE.map((trait) => trait.id)
});
const boardSignature = (board) => programTraitPriorityBuckets.map((bucket) => `${bucket}:${board[bucket].map((trait) => trait.id).join(",")}`).join("|");
export const isBoardDirty = (board, savedBoard) => boardSignature(board) !== boardSignature(savedBoard);

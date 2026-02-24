import { describe, expect, it } from "vitest";
import { createEmptyProgramBoardState, isBoardDirty, removeTraitFromBoard, toBoardIdState } from "./program-board-state";
describe("program board state", () => {
    it("removes a trait from the correct column and toggles dirty state", () => {
        const saved = createEmptyProgramBoardState();
        saved.CRITICAL = [{ id: "trait-1", name: "Analytical Thinking", category: "ACADEMIC" }];
        saved.IMPORTANT = [{ id: "trait-2", name: "Communication", category: "INTERPERSONAL" }];
        const { nextBoard, removed } = removeTraitFromBoard(saved, "trait-1");
        expect(removed).toBe(true);
        expect(nextBoard.CRITICAL).toHaveLength(0);
        expect(nextBoard.IMPORTANT).toHaveLength(1);
        expect(nextBoard.IMPORTANT[0]?.id).toBe("trait-2");
        expect(isBoardDirty(nextBoard, saved)).toBe(true);
    });
    it("builds persistence payload IDs without removed traits", () => {
        const board = createEmptyProgramBoardState();
        board.VERY_IMPORTANT = [{ id: "trait-a", name: "Drive", category: "MOTIVATION" }];
        board.NICE_TO_HAVE = [{ id: "trait-b", name: "Teamwork", category: "INTERPERSONAL" }];
        const { nextBoard } = removeTraitFromBoard(board, "trait-b");
        const ids = toBoardIdState(nextBoard);
        expect(ids.VERY_IMPORTANT).toEqual(["trait-a"]);
        expect(ids.NICE_TO_HAVE).toEqual([]);
    });
});

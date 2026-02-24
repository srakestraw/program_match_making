import { create } from "zustand";
export const useWidgetStore = create((set) => ({
    sessionId: null,
    programId: null,
    mode: null,
    transcript: [],
    scorecard: null,
    scoringSnapshot: null,
    programFit: null,
    setSessionId: (sessionId) => set({ sessionId }),
    setProgramId: (programId) => set({ programId }),
    setMode: (mode) => set({ mode }),
    setScorecard: (scorecard) => set({ scorecard }),
    setScoringSnapshot: (scoringSnapshot) => set({ scoringSnapshot }),
    setProgramFit: (programFit) => set({ programFit }),
    addTranscriptTurn: (turn) => set((state) => {
        const normalized = turn.text.trim();
        if (!normalized)
            return state;
        if (turn.speaker === "assistant" && state.transcript.length > 0) {
            const last = state.transcript[state.transcript.length - 1];
            if (last.speaker === "assistant" && last.id === turn.id) {
                const updated = [...state.transcript];
                updated[updated.length - 1] = { ...last, text: `${last.text}${turn.text}` };
                return { transcript: updated };
            }
        }
        return { transcript: [...state.transcript, { ...turn, text: normalized }] };
    }),
    clear: () => set({
        sessionId: null,
        programId: null,
        mode: null,
        transcript: [],
        scorecard: null,
        scoringSnapshot: null,
        programFit: null
    })
}));

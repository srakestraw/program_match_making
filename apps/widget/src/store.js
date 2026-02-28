import { create } from "zustand";
export const useWidgetStore = create((set) => ({
    sessionId: null,
    programId: null,
    programFilterIds: [],
    mode: null,
    transcript: [],
    scorecard: null,
    scoringSnapshot: null,
    programFit: null,
    answeredTraitCount: 0,
    checkpoint: null,
    voicePhase: "init",
    voiceInputMode: "handsfree",
    sessionLanguageTag: "en",
    sessionLanguageLabel: "English",
    detectedLanguageSuggestion: null,
    setSessionId: (sessionId) => set({ sessionId }),
    setProgramId: (programId) => set({ programId }),
    setProgramFilterIds: (programFilterIds) => set({ programFilterIds }),
    setMode: (mode) => set({ mode }),
    setScorecard: (scorecard) => set({ scorecard }),
    setScoringSnapshot: (scoringSnapshot) => set({ scoringSnapshot }),
    setProgramFit: (programFit) => set({ programFit }),
    setAnsweredTraitCount: (answeredTraitCount) => set({ answeredTraitCount }),
    setCheckpoint: (checkpoint) => set({ checkpoint }),
    setVoicePhase: (voicePhase) => set({ voicePhase }),
    setVoiceInputMode: (voiceInputMode) => set({ voiceInputMode }),
    setSessionLanguage: (sessionLanguageTag, sessionLanguageLabel) => set({
        sessionLanguageTag,
        sessionLanguageLabel: sessionLanguageLabel ?? sessionLanguageTag,
        detectedLanguageSuggestion: null
    }),
    setDetectedLanguage: (tag, label) => set((state) => {
        if (state.sessionLanguageTag.toLowerCase() === tag.toLowerCase()) {
            return state;
        }
        return {
            detectedLanguageSuggestion: { tag, label, dismissed: false }
        };
    }),
    dismissDetectedLanguage: () => set((state) => ({
        detectedLanguageSuggestion: state.detectedLanguageSuggestion
            ? { ...state.detectedLanguageSuggestion, dismissed: true }
            : null
    })),
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
        programFilterIds: [],
        mode: null,
        transcript: [],
        scorecard: null,
        scoringSnapshot: null,
        programFit: null,
        answeredTraitCount: 0,
        checkpoint: null,
        voicePhase: "init",
        voiceInputMode: "handsfree",
        sessionLanguageTag: "en",
        sessionLanguageLabel: "English",
        detectedLanguageSuggestion: null
    })
}));

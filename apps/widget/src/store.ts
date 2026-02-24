import { create } from "zustand";
import type { TranscriptTurn } from "@pmm/voice";
import type { ProgramFit, Scorecard, ScoringSnapshot } from "@pmm/api-client";

type InterviewMode = "voice" | "chat" | "quiz";

type WidgetStore = {
  sessionId: string | null;
  programId: string | null;
  mode: InterviewMode | null;
  transcript: TranscriptTurn[];
  scorecard: Scorecard | null;
  scoringSnapshot: ScoringSnapshot | null;
  programFit: ProgramFit | null;
  setSessionId: (sessionId: string | null) => void;
  setProgramId: (programId: string | null) => void;
  setMode: (mode: InterviewMode | null) => void;
  setScorecard: (scorecard: Scorecard | null) => void;
  setScoringSnapshot: (scoringSnapshot: ScoringSnapshot | null) => void;
  setProgramFit: (programFit: ProgramFit | null) => void;
  addTranscriptTurn: (turn: TranscriptTurn) => void;
  clear: () => void;
};

export const useWidgetStore = create<WidgetStore>((set) => ({
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
  addTranscriptTurn: (turn) =>
    set((state) => {
      const normalized = turn.text.trim();
      if (!normalized) return state;

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
  clear: () =>
    set({
      sessionId: null,
      programId: null,
      mode: null,
      transcript: [],
      scorecard: null,
      scoringSnapshot: null,
      programFit: null
    })
}));

import { create } from "zustand";
import type { TranscriptTurn } from "@pmm/voice";
import type { ProgramFit, Scorecard, ScoringSnapshot } from "@pmm/api-client";
import type { VoiceInputMode, VoicePhase } from "./lib/voiceState";

type InterviewMode = "voice" | "chat" | "quiz";

type CheckpointState = {
  required: boolean;
  answeredTraitCount: number;
  prompt: string;
  suggestedTraitIds: string[];
} | null;

type DetectedLanguageSuggestion = {
  tag: string;
  label: string;
  dismissed: boolean;
} | null;

type WidgetStore = {
  sessionId: string | null;
  programId: string | null;
  programFilterIds: string[];
  mode: InterviewMode | null;
  transcript: TranscriptTurn[];
  scorecard: Scorecard | null;
  scoringSnapshot: ScoringSnapshot | null;
  programFit: ProgramFit | null;
  answeredTraitCount: number;
  checkpoint: CheckpointState;
  voicePhase: VoicePhase;
  voiceInputMode: VoiceInputMode;
  sessionLanguageTag: string;
  sessionLanguageLabel: string;
  detectedLanguageSuggestion: DetectedLanguageSuggestion;
  setSessionId: (sessionId: string | null) => void;
  setProgramId: (programId: string | null) => void;
  setProgramFilterIds: (programFilterIds: string[]) => void;
  setMode: (mode: InterviewMode | null) => void;
  setScorecard: (scorecard: Scorecard | null) => void;
  setScoringSnapshot: (scoringSnapshot: ScoringSnapshot | null) => void;
  setProgramFit: (programFit: ProgramFit | null) => void;
  setAnsweredTraitCount: (answeredTraitCount: number) => void;
  setCheckpoint: (checkpoint: CheckpointState) => void;
  setVoicePhase: (voicePhase: VoicePhase) => void;
  setVoiceInputMode: (voiceInputMode: VoiceInputMode) => void;
  setSessionLanguage: (tag: string, label?: string) => void;
  setDetectedLanguage: (tag: string, label: string) => void;
  dismissDetectedLanguage: () => void;
  addTranscriptTurn: (turn: TranscriptTurn) => void;
  clear: () => void;
};

export const useWidgetStore = create<WidgetStore>((set) => ({
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
  setSessionLanguage: (sessionLanguageTag, sessionLanguageLabel) =>
    set({
      sessionLanguageTag,
      sessionLanguageLabel: sessionLanguageLabel ?? sessionLanguageTag,
      detectedLanguageSuggestion: null
    }),
  setDetectedLanguage: (tag, label) =>
    set((state) => {
      if (state.sessionLanguageTag.toLowerCase() === tag.toLowerCase()) {
        return state;
      }
      return {
        detectedLanguageSuggestion: { tag, label, dismissed: false }
      };
    }),
  dismissDetectedLanguage: () =>
    set((state) => ({
      detectedLanguageSuggestion: state.detectedLanguageSuggestion
        ? { ...state.detectedLanguageSuggestion, dismissed: true }
        : null
    })),
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

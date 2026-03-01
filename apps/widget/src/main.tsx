import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useNavigate,
  useSearchParams
} from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Button, Card } from "@pmm/ui";
import { createApiClient, type ProgramFit, type ScoringSnapshot, type WidgetTheme } from "@pmm/api-client";
import { RealtimeSession, type ConnectionState, type TranscriptTurn } from "@pmm/voice";
import { ProgramFloatField } from "./components/ProgramFloatField";
import { TraitScorePanel } from "./components/TraitScorePanel";
import { VoiceBlob } from "./components/VoiceBlob";
import { useWidgetStore } from "./store";
import {
  getVoicePhaseLabel,
  isConnectedPhase,
  reduceVoicePhase,
  shouldKickoff,
  toVoiceBlobState,
  type VoicePhase
} from "./lib/voiceState";
import { createLanguageUtterance } from "./lib/browserTts";
import { ALL_LANGUAGE_OPTIONS, EXTRA_LANGUAGE_OPTIONS, PRIMARY_LANGUAGE_OPTIONS, languageLabelFromTag } from "./constants/languages";
import { LanguagePills } from "./components/LanguagePills";
import { LanguagePickerModal } from "./components/LanguagePickerModal";
import { InterviewTypeIllustration } from "./components/illustrations/InterviewTypeIllustration";
import { SwipeTransition } from "./components/quiz/SwipeTransition";
import { SurpriseAnimationLayer, pickSurpriseVariant } from "./components/quiz/SurpriseAnimationLayer";
import "./styles.css";

const queryClient = new QueryClient();
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000" });

type InterviewMode = "voice" | "chat" | "quiz";

const modeOptions: Array<{ id: InterviewMode; label: string; description: string }> = [
  { id: "voice", label: "Voice", description: "Live conversational interview" },
  { id: "chat", label: "Chat", description: "Trait-driven text interview" },
  { id: "quiz", label: "Quiz", description: "Swipe through quick questions" }
];

const parseModeParam = (value: string | null): InterviewMode | null => {
  if (value === "voice" || value === "chat" || value === "quiz") return value;
  return null;
};

const transcriptId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const interestOnboardingPrompt =
  "Before we begin trait matching, what are you most interested in studying and what skills do you most enjoy using?";

const formatTraitKickoffPrefix = (nextQuestion: { traitName?: string }, prefetchedQuestions?: Array<{ traitName?: string }>) => {
  const traitNames = Array.from(
    new Set(
      [nextQuestion.traitName, ...(prefetchedQuestions ?? []).map((question) => question.traitName)]
        .map((name) => (name ?? "").trim())
        .filter((name) => name.length > 0)
    )
  ).slice(0, 3);

  if (traitNames.length === 0) {
    return "Thanks. I heard your interests and skills. Let us begin trait matching.";
  }

  if (traitNames.length === 1) {
    return `Thanks. I heard your interests and skills. We will start by evaluating ${traitNames[0]}.`;
  }

  if (traitNames.length === 2) {
    return `Thanks. I heard your interests and skills. We will start by evaluating ${traitNames[0]} and ${traitNames[1]}.`;
  }

  return `Thanks. I heard your interests and skills. We will start by evaluating ${traitNames[0]}, ${traitNames[1]}, and ${traitNames[2]}.`;
};

const defaultWidgetThemeTokens: WidgetTheme["tokens"] = {
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  headingFontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  colors: {
    primary: "#0f172a",
    primaryHover: "#1e293b",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    mutedText: "#475569",
    border: "rgba(15, 23, 42, 0.14)"
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 14
  },
  shadows: {
    card: "0 8px 26px rgba(15, 23, 42, 0.08)"
  },
  logoUrl: undefined
};

const widgetThemeVariantFromUrl = (): "active" | "draft" => {
  if (typeof window === "undefined") return "active";
  return new URLSearchParams(window.location.search).get("theme") === "draft" ? "draft" : "active";
};

const themeCssVars = (tokens: WidgetTheme["tokens"]): React.CSSProperties =>
  ({
    "--pm-font": tokens.fontFamily || defaultWidgetThemeTokens.fontFamily,
    "--pm-heading-font": tokens.headingFontFamily || tokens.fontFamily || defaultWidgetThemeTokens.headingFontFamily,
    "--pm-primary": tokens.colors.primary || defaultWidgetThemeTokens.colors.primary,
    "--pm-primary-hover": tokens.colors.primaryHover || defaultWidgetThemeTokens.colors.primaryHover,
    "--pm-bg": tokens.colors.background || defaultWidgetThemeTokens.colors.background,
    "--pm-surface": tokens.colors.surface || defaultWidgetThemeTokens.colors.surface,
    "--pm-text": tokens.colors.text || defaultWidgetThemeTokens.colors.text,
    "--pm-muted": tokens.colors.mutedText || defaultWidgetThemeTokens.colors.mutedText,
    "--pm-border": tokens.colors.border || defaultWidgetThemeTokens.colors.border,
    "--pm-radius-sm": `${tokens.radii.sm ?? defaultWidgetThemeTokens.radii.sm}px`,
    "--pm-radius-md": `${tokens.radii.md ?? defaultWidgetThemeTokens.radii.md}px`,
    "--pm-radius-lg": `${tokens.radii.lg ?? defaultWidgetThemeTokens.radii.lg}px`,
    "--pm-card-shadow": tokens.shadows?.card || defaultWidgetThemeTokens.shadows?.card || "none"
  }) as React.CSSProperties;

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  return isOnline;
};

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return prefersReducedMotion;
};

const LiveInsightsSidebar = ({
  snapshot,
  programFit,
  activeTraitId,
  done = false,
  onActiveTraitAction,
  activeTraitActionPending,
  updatingMatches = false,
  reducedMotion = false,
  rankingPulseToken = null
}: {
  snapshot: ScoringSnapshot | null;
  programFit: ProgramFit | null;
  activeTraitId?: string | null;
  done?: boolean;
  onActiveTraitAction?: (action: "continue" | "deepen") => void;
  activeTraitActionPending?: boolean;
  updatingMatches?: boolean;
  reducedMotion?: boolean;
  rankingPulseToken?: number | null;
}) => (
  <aside className="space-y-3">
    <TraitScorePanel
      traits={snapshot?.traits ?? []}
      activeTraitId={activeTraitId ?? null}
      done={done}
      onActiveTraitAction={onActiveTraitAction}
      actionPending={activeTraitActionPending}
    />
    <ProgramFloatField
      programs={programFit?.programs ?? []}
      selectedProgramId={programFit?.selectedProgramId ?? null}
      done={done}
      updatingMatches={updatingMatches}
      reducedMotion={reducedMotion}
      pulseToken={rankingPulseToken}
    />
  </aside>
);

const WidgetSetup = () => {
  const [searchParams] = useSearchParams();
  const queryMode = parseModeParam(searchParams.get("mode"));
  const lockMode = queryMode !== null || ["1", "true", "yes"].includes((searchParams.get("lockMode") ?? "").toLowerCase());
  const queryProgramId = searchParams.get("programId");
  const programFilterIds = queryProgramId ? [queryProgramId] : [];
  const [selectedMode, setSelectedMode] = useState<InterviewMode | null>(queryMode);
  const [started, setStarted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [selectorRailRect, setSelectorRailRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const modeGridRef = useRef<HTMLDivElement | null>(null);
  const modeButtonRefs = useRef<Record<InterviewMode, HTMLButtonElement | null>>({
    voice: null,
    chat: null,
    quiz: null
  });

  const clear = useWidgetStore((state) => state.clear);
  const setMode = useWidgetStore((state) => state.setMode);
  const setProgramId = useWidgetStore((state) => state.setProgramId);
  const setProgramFilterIds = useWidgetStore((state) => state.setProgramFilterIds);

  useEffect(() => {
    if (queryMode) setSelectedMode(queryMode);
  }, [queryMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(media.matches);
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  const positionSelectorRail = useCallback(() => {
    if (lockMode || !selectedMode) {
      setSelectorRailRect(null);
      return;
    }
    const gridEl = modeGridRef.current;
    const buttonEl = modeButtonRefs.current[selectedMode];
    if (!gridEl || !buttonEl) return;
    const gridRect = gridEl.getBoundingClientRect();
    const buttonRect = buttonEl.getBoundingClientRect();
    setSelectorRailRect({
      x: buttonRect.left - gridRect.left - 1,
      y: buttonRect.top - gridRect.top - 1,
      width: buttonRect.width + 2,
      height: buttonRect.height + 2
    });
  }, [lockMode, selectedMode]);

  useLayoutEffect(() => {
    positionSelectorRail();
  }, [positionSelectorRail]);

  useEffect(() => {
    if (lockMode) return;
    const gridEl = modeGridRef.current;
    if (!gridEl) return;
    const onResize = () => positionSelectorRail();
    window.addEventListener("resize", onResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(onResize);
      observer.observe(gridEl);
      Object.values(modeButtonRefs.current).forEach((button) => {
        if (button) observer?.observe(button);
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [lockMode, positionSelectorRail]);

  const canStart = Boolean(selectedMode);

  if (started && selectedMode) {
    if (selectedMode === "voice") {
      return <VoiceFlow mode={selectedMode} programFilterIds={programFilterIds} onRestart={() => setStarted(false)} />;
    }
    if (selectedMode === "chat") {
      return <ChatFlow mode={selectedMode} programFilterIds={programFilterIds} onRestart={() => setStarted(false)} />;
    }
    return <QuizFlow mode={selectedMode} programFilterIds={programFilterIds} onRestart={() => setStarted(false)} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card>
        <section className="space-y-4">
          <h1 className="text-3xl font-bold">Program Match Interview</h1>
          <p className="text-sm text-slate-600">Choose interview type to begin. Program ranking starts after your first responses.</p>

          {!lockMode && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Interview type</p>
              <div ref={modeGridRef} className="relative grid gap-2 sm:grid-cols-3">
                {selectorRailRect && (
                  <div
                    aria-hidden="true"
                    className={`selector-rail ${prefersReducedMotion ? "selector-rail-reduced-motion" : "selector-rail-animated"}`}
                    style={{
                      width: selectorRailRect.width,
                      height: selectorRailRect.height,
                      transform: `translate(${selectorRailRect.x}px, ${selectorRailRect.y}px)`
                    }}
                  />
                )}
                {modeOptions.map((mode) => {
                  const isSelected = selectedMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={isSelected}
                      ref={(element) => {
                        modeButtonRefs.current[mode.id] = element;
                      }}
                      className={`interview-type-option relative z-10 rounded-md border p-3 text-left transition ${isSelected ? "mode-option-selected border-slate-900 bg-slate-100 ring-1 ring-slate-900/10" : "border-slate-200 bg-white hover:border-slate-300"} ${mode.id === "quiz" ? "interview-type-option-quiz" : ""} ${prefersReducedMotion ? "motion-reduce:transition-none" : "duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"}`}
                      onClick={() => setSelectedMode(mode.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mode-option-ill-wrap" aria-hidden="true">
                          <InterviewTypeIllustration type={mode.id} size={44} quizVariant="ghost" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
                            {isSelected && (
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">{mode.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {lockMode && selectedMode && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">Mode locked to: {selectedMode.toUpperCase()}</p>
          )}

          {programFilterIds.length > 0 && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">Program filter from URL is active (1 program).</p>
          )}

          <Button
            disabled={!canStart}
            onClick={() => {
              clear();
              setMode(selectedMode);
              setProgramFilterIds(programFilterIds);
              setProgramId(programFilterIds[0] ?? null);
              setStarted(true);
            }}
          >
            Start
          </Button>

        </section>
      </Card>
    </main>
  );
};

const VoiceFlow = ({ mode, programFilterIds, onRestart }: { mode: InterviewMode; programFilterIds: string[]; onRestart: () => void }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [transportState, setTransportState] = useState<ConnectionState>("idle");
  const [deviceLabel, setDeviceLabel] = useState("Unknown microphone");
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [collectingPreferences, setCollectingPreferences] = useState(false);
  const [askedTraitIds, setAskedTraitIds] = useState<string[]>([]);
  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>([]);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [connectStalled, setConnectStalled] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [speechEngine, setSpeechEngine] = useState<"realtime-brand-voice" | "browser-fallback" | "none">("none");
  const [lastMintedVoice, setLastMintedVoice] = useState<string | null>(null);
  const [debugVoiceEnabled, setDebugVoiceEnabled] = useState(false);

  const realtimeSessionRef = useRef<RealtimeSession | null>(null);
  const onTranscriptTurnRef = useRef<((turn: TranscriptTurn) => Promise<void>) | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const lastCandidateTurnIdRef = useRef<string | null>(null);
  const kickoffStartedRef = useRef(false);
  const realtimeSpeechFallbackTimerRef = useRef<number | null>(null);
  const realtimeAssistantStartedRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const isOnline = useOnlineStatus();

  const {
    transcript,
    scoringSnapshot,
    programFit,
    checkpoint,
    voicePhase,
    voiceInputMode,
    sessionLanguageTag,
    sessionLanguageLabel,
    detectedLanguageSuggestion,
    setSessionId,
    addTranscriptTurn,
    setMode,
    setProgramFilterIds,
    setScoringSnapshot,
    setProgramFit,
    setAnsweredTraitCount,
    setCheckpoint,
    setVoicePhase,
    setVoiceInputMode,
    setSessionLanguage,
    setDetectedLanguage,
    dismissDetectedLanguage,
    clear
  } = useWidgetStore();

  const debugVoice = (message: string, details?: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("DEBUG_VOICE") !== "1") return;
    console.info("[voice]", message, details ?? {});
  };

  const transitionPhase = (event: Parameters<typeof reduceVoicePhase>[1]) => {
    const next = reduceVoicePhase(useWidgetStore.getState().voicePhase, event);
    debugVoice("phase", { from: useWidgetStore.getState().voicePhase, to: next, event });
    setVoicePhase(next);
  };

  const setMicListeningState = (enabled: boolean) => {
    const active = enabled && voiceInputMode === "handsfree" && voicePhase === "listening";
    realtimeSessionRef.current?.setPushToTalk(active);
    debugVoice("mic", { enabled: active, inputMode: voiceInputMode, phase: voicePhase });
  };

  const isLiveInterviewPhase = (phase: VoicePhase) => ["kickoff", "speaking", "listening", "thinking"].includes(phase);

  useEffect(() => {
    setMode(mode);
    setProgramFilterIds(programFilterIds);
    setSessionLanguage("en", "English");
  }, [mode, programFilterIds, setMode, setProgramFilterIds, setSessionLanguage]);

  useEffect(() => {
    if (!checkpoint?.required) return;
    setCheckpointOpen(true);
    setVoicePhase("paused");
  }, [checkpoint, setVoicePhase]);

  useEffect(() => {
    if (voicePhase === "listening") {
      setMicListeningState(true);
      return;
    }
    setMicListeningState(false);
  }, [voicePhase, voiceInputMode]);

  useEffect(() => {
    if (voicePhase !== "connecting") {
      setConnectStalled(false);
      return;
    }
    const timeout = window.setTimeout(() => setConnectStalled(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [voicePhase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDebugVoiceEnabled(window.localStorage.getItem("DEBUG_VOICE") === "1");
  }, []);

  useEffect(() => {
    if (!realtimeSessionRef.current) return;
    if (!isConnectedPhase(voicePhase)) return;
    realtimeSessionRef.current.updateSession({
      instructions: `You are a warm admissions interviewer. Respond in ${sessionLanguageLabel} only. Do not switch languages unless the user explicitly asks.`,
      inputAudioLanguage: sessionLanguageTag
    });
  }, [sessionLanguageTag, sessionLanguageLabel, voicePhase]);

  const tokenMutation = useMutation({
    mutationFn: (input?: { brandVoiceId?: string; voiceName?: string; language?: string; debug?: boolean }) => api.getRealtimeToken(input)
  });
  const appendTranscriptMutation = useMutation({
    mutationFn: ({ id, turns }: { id: string; turns: Array<{ ts: string; speaker: "candidate" | "assistant"; text: string }> }) =>
      api.appendTranscript(id, turns)
  });
  const createInterviewMutation = useMutation({
    mutationFn: () =>
      api.createInterviewSession({
        mode,
        language: sessionLanguageTag,
        programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
      })
  });
  const turnMutation = useMutation({
    mutationFn: (text: string) =>
      api.submitInterviewTurn(sessionIdRef.current!, {
        mode,
        text,
        language: sessionLanguageTag,
        traitId: currentQuestion?.traitId,
        questionId: currentQuestion?.id,
        askedTraitIds,
        askedQuestionIds,
        programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
      })
  });
  const checkpointMutation = useMutation({
    mutationFn: (action: "stop" | "continue" | "focus" | "deepen") =>
      api.submitInterviewCheckpoint(sessionIdRef.current!, {
        mode,
        action,
        language: sessionLanguageTag,
        focusTraitIds: action === "focus" ? checkpoint?.suggestedTraitIds : undefined,
        currentTraitId: currentQuestion?.traitId,
        askedTraitIds,
        askedQuestionIds,
        programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
      })
  });

  const speakPrompt = (text: string) => {
    const speakWithBrowserTts = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        transitionPhase("assistant_done");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = createLanguageUtterance(text, sessionLanguageTag, window.speechSynthesis.getVoices?.() ?? []);
      utterance.onstart = () => {
        debugVoice("tts.start.browser", { chars: text.length });
        setSpeechEngine("browser-fallback");
        setVoicePhase("speaking");
      };
      utterance.onend = () => {
        debugVoice("tts.end.browser");
        transitionPhase("assistant_done");
      };
      utterance.onerror = () => {
        transitionPhase("assistant_done");
      };
      window.speechSynthesis.speak(utterance);
    };

    const realtime = realtimeSessionRef.current;
    if (realtime && realtime.connectionState === "connected") {
      realtimeAssistantStartedRef.current = false;
      setSpeechEngine("realtime-brand-voice");
      setVoicePhase("speaking");
      debugVoice("tts.start.realtime", { chars: text.length });
      realtime.promptAssistant(
        `Respond in ${sessionLanguageLabel}. Say exactly this text and nothing else: "${text}"`
      );

      if (realtimeSpeechFallbackTimerRef.current !== null) {
        window.clearTimeout(realtimeSpeechFallbackTimerRef.current);
      }
      realtimeSpeechFallbackTimerRef.current = window.setTimeout(() => {
        if (!realtimeAssistantStartedRef.current) {
          debugVoice("tts.fallback.browser", { reason: "no_realtime_audio_start" });
          speakWithBrowserTts();
        }
      }, 3500);
      return;
    }

    speakWithBrowserTts();
  };

  const pushAssistantQuestion = async (question: any, prefix?: string) => {
    if (!question) return;
    setCurrentQuestion(question);
    setAskedQuestionIds((prev) => (prev.includes(question.id) ? prev : [...prev, question.id]));
    setAskedTraitIds((prev) => [...prev, question.traitId]);
    const text = prefix ? `${prefix} ${question.prompt}` : question.prompt;
    addTranscriptTurn({ id: transcriptId("assistant"), speaker: "assistant", text, ts: new Date().toISOString() });
    if (sessionIdRef.current) {
      void appendTranscriptMutation.mutateAsync({
        id: sessionIdRef.current,
        turns: [{ ts: new Date().toISOString(), speaker: "assistant", text }]
      });
    }
    transitionPhase("kickoff_ready");
    speakPrompt(text);
  };

  const kickoffIfNeeded = async (interview: Awaited<ReturnType<typeof api.createInterviewSession>>) => {
    if (!shouldKickoff(useWidgetStore.getState().voicePhase, kickoffStartedRef.current)) return;
    kickoffStartedRef.current = true;
    debugVoice("kickoff.called", { sessionId: sessionIdRef.current });
    setScoringSnapshot(interview.scoring_snapshot ?? null);
    setProgramFit(interview.program_fit ?? null);
    setCheckpoint(interview.checkpoint ?? null);
    setAnsweredTraitCount(interview.answeredTraitCount ?? 0);
    if (interview.nextQuestion) {
      const onboardingText = interview.initialPrompt ? `${interview.initialPrompt} ${interestOnboardingPrompt}` : interestOnboardingPrompt;
      setCurrentQuestion(null);
      setCollectingPreferences(true);
      addTranscriptTurn({ id: transcriptId("assistant"), speaker: "assistant", text: onboardingText, ts: new Date().toISOString() });
      if (sessionIdRef.current) {
        void appendTranscriptMutation.mutateAsync({
          id: sessionIdRef.current,
          turns: [{ ts: new Date().toISOString(), speaker: "assistant", text: onboardingText }]
        });
      }
      transitionPhase("kickoff_ready");
      speakPrompt(onboardingText);
      return;
    }
    if (interview.initialPrompt) {
      addTranscriptTurn({ id: transcriptId("assistant"), speaker: "assistant", text: interview.initialPrompt, ts: new Date().toISOString() });
      transitionPhase("kickoff_ready");
      speakPrompt(interview.initialPrompt);
      return;
    }
    transitionPhase("assistant_done");
  };

  const onTranscriptTurn = async (turn: TranscriptTurn) => {
    if (turn.speaker === "assistant") {
      realtimeAssistantStartedRef.current = true;
      if (realtimeSpeechFallbackTimerRef.current !== null) {
        window.clearTimeout(realtimeSpeechFallbackTimerRef.current);
        realtimeSpeechFallbackTimerRef.current = null;
      }
      return;
    }
    if (turn.speaker !== "candidate") {
      return;
    }
    if (voicePhase !== "listening") return;
    if (lastCandidateTurnIdRef.current === turn.id) return;
    lastCandidateTurnIdRef.current = turn.id;

    addTranscriptTurn(turn);
    debugVoice("transcript.candidate", { chars: turn.text.length });
    const lowerTurn = turn.text.toLowerCase();
    if (/\b(hola|gracias|por favor|buenos|buenas|adios)\b/i.test(turn.text) || /\bspanish|español\b/i.test(turn.text)) {
      setDetectedLanguage("es", languageLabelFromTag("es"));
    } else if (/\bfrench|français\b/i.test(turn.text)) {
      setDetectedLanguage("fr", languageLabelFromTag("fr"));
    } else if (/\bchinese|mandarin\b/i.test(turn.text)) {
      setDetectedLanguage("zh", languageLabelFromTag("zh"));
    } else if (/\barabic\b/i.test(turn.text)) {
      setDetectedLanguage("ar", languageLabelFromTag("ar"));
    }
    if (/can we do this in\s+([a-z]+)/i.test(lowerTurn) || /switch to\s+([a-z]+)/i.test(lowerTurn)) {
      debugVoice("language.explicit-request", { text: turn.text.slice(0, 120) });
    }
    if (sessionIdRef.current) {
      void appendTranscriptMutation.mutateAsync({
        id: sessionIdRef.current,
        turns: [{ ts: turn.ts, speaker: turn.speaker, text: turn.text }]
      });
    }
    transitionPhase("user_transcript_finalized");
    try {
      const result = await turnMutation.mutateAsync(turn.text);
      setScoringSnapshot(result.scoring_snapshot);
      setProgramFit(result.program_fit);
      setAnsweredTraitCount(result.answeredTraitCount);
      setCheckpoint(result.checkpoint);
      const wasCollectingPreferences = collectingPreferences;
      if (collectingPreferences) {
        setCollectingPreferences(false);
      }
      if (result.checkpoint?.required) {
        setCheckpointOpen(true);
        setVoicePhase("paused");
        return;
      }
      if (result.nextQuestion) {
        const kickoffPrefix = wasCollectingPreferences
          ? formatTraitKickoffPrefix(result.nextQuestion, result.prefetchedQuestions)
          : undefined;
        await pushAssistantQuestion(result.nextQuestion, kickoffPrefix);
      } else {
        setVoicePhase("ended");
      }
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : "Could not score voice turn.");
      setVoicePhase("error");
    }
  };
  onTranscriptTurnRef.current = onTranscriptTurn;

  const startInterview = async () => {
    setError(null);
    if (sessionIdRef.current && transcript.length > 0 && currentQuestion) {
      transitionPhase("assistant_done");
      return;
    }
    transitionPhase("request_permissions");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const [track] = stream.getAudioTracks();
      setDeviceLabel(track.label || "Microphone ready");
      transitionPhase("permissions_granted");

      const interview = await createInterviewMutation.mutateAsync();
      const responseLanguageTag = interview.languageTag ?? interview.language ?? sessionLanguageTag;
      setSessionLanguage(responseLanguageTag, languageLabelFromTag(responseLanguageTag));
      const debugEnabled = typeof window !== "undefined" && window.localStorage.getItem("DEBUG_VOICE") === "1";
      const token = await tokenMutation.mutateAsync({
        brandVoiceId: interview.brandVoiceId ?? undefined,
        language: responseLanguageTag,
        debug: debugEnabled
      });
      setLastMintedVoice(token.debug?.selectedVoice ?? null);
      const id = interview.sessionId;
      if (!id) throw new Error("Session id missing");
      setSessionId(id);
      sessionIdRef.current = id;
      intentionalDisconnectRef.current = false;
      debugVoice("session.ready", { sessionId: id });

      const realtimeSession = new RealtimeSession({
        onStateChange: (state) => {
          setTransportState(state);
          debugVoice("transport.state", { state });
          if (state === "connected") {
            intentionalDisconnectRef.current = false;
          }
          if (state === "disconnected" && isLiveInterviewPhase(useWidgetStore.getState().voicePhase) && !intentionalDisconnectRef.current) {
            setError("Connection dropped. Please restart the interview when ready.");
            setVoicePhase("error");
          }
        },
        onDetectedLanguage: (tag) => {
          const normalized = tag.toLowerCase();
          const current = useWidgetStore.getState().sessionLanguageTag.toLowerCase();
          if (normalized !== current) {
            setDetectedLanguage(tag, languageLabelFromTag(tag));
          }
        },
        onAssistantAudioStart: () => {
          realtimeAssistantStartedRef.current = true;
          if (realtimeSpeechFallbackTimerRef.current !== null) {
            window.clearTimeout(realtimeSpeechFallbackTimerRef.current);
            realtimeSpeechFallbackTimerRef.current = null;
          }
        },
        onAssistantDone: () => {
          debugVoice("tts.end.realtime");
          if (realtimeSpeechFallbackTimerRef.current !== null) {
            window.clearTimeout(realtimeSpeechFallbackTimerRef.current);
            realtimeSpeechFallbackTimerRef.current = null;
          }
          transitionPhase("assistant_done");
        },
        onTranscriptTurn: (turn) => {
          const handler = onTranscriptTurnRef.current;
          if (!handler) return;
          void handler(turn);
        }
      });
      realtimeSession.setAudioTrack(track);
      realtimeSessionRef.current = realtimeSession;
      await realtimeSession.connect(token.client_secret.value);
      realtimeSession.updateSession({
        instructions:
          interview.systemPrompt ??
          `You are a warm admissions interviewer. Respond in ${languageLabelFromTag(responseLanguageTag)} only. Do not switch languages unless the user explicitly asks.`,
        inputAudioLanguage: responseLanguageTag
      });
      transitionPhase("transport_connected");
      await kickoffIfNeeded(interview);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start voice interview.");
      setVoicePhase("error");
    }
  };

  const handleCheckpointAction = async (action: "stop" | "continue" | "focus" | "deepen") => {
    try {
      const response = await checkpointMutation.mutateAsync(action);
      setScoringSnapshot(response.scoring_snapshot);
      setProgramFit(response.program_fit);
      setCheckpoint(null);
      setCheckpointOpen(false);
      if (action === "stop") {
        setVoicePhase("ended");
        return;
      }
      if (response.nextQuestion) {
        await pushAssistantQuestion(response.nextQuestion);
      } else {
        transitionPhase("resume");
      }
    } catch (checkpointError) {
      setError(checkpointError instanceof Error ? checkpointError.message : "Checkpoint action failed.");
      setVoicePhase("error");
    }
  };

  const endSession = async () => {
    try {
      if (realtimeSpeechFallbackTimerRef.current !== null) {
        window.clearTimeout(realtimeSpeechFallbackTimerRef.current);
        realtimeSpeechFallbackTimerRef.current = null;
      }
      window.speechSynthesis?.cancel();
      intentionalDisconnectRef.current = true;
      await realtimeSessionRef.current?.disconnect();
      if (sessionIdRef.current) await api.completeSession(sessionIdRef.current);
    } catch {
      setError("Session ended with errors. Transcript kept locally.");
    } finally {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      setVoicePhase("ended");
    }
  };

  const resetFlow = async () => {
    intentionalDisconnectRef.current = true;
    await realtimeSessionRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (realtimeSpeechFallbackTimerRef.current !== null) {
      window.clearTimeout(realtimeSpeechFallbackTimerRef.current);
      realtimeSpeechFallbackTimerRef.current = null;
    }
    window.speechSynthesis?.cancel();
    clear();
    setTransportState("idle");
    setError(null);
    setCheckpointOpen(false);
    setCurrentQuestion(null);
    setCollectingPreferences(false);
    setAskedQuestionIds([]);
    setAskedTraitIds([]);
    kickoffStartedRef.current = false;
    onRestart();
  };

  const connectionLabel = useMemo(() => {
    if (isConnectedPhase(voicePhase)) return "Connected";
    if (transportState === "connecting" || voicePhase === "connecting") return "Connecting";
    if (transportState === "error" || voicePhase === "error") return "Error";
    if (transportState === "disconnected") return "Disconnected";
    return "Not connected";
  }, [transportState, voicePhase]);

  const canStart = voicePhase === "init" || voicePhase === "permissions" || voicePhase === "error";
  const activeSession = !["init", "permissions", "connecting", "error", "ended"].includes(voicePhase);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Adaptive voice interview</h2>
            <VoiceBlob state={toVoiceBlobState(voicePhase)} />
            <p className="text-sm text-slate-700">
              State: <span className="font-semibold">{getVoicePhaseLabel(voicePhase)}</span> | Connection: {connectionLabel}
            </p>
            <div className="space-y-2">
              <p className="text-sm text-slate-700">Language</p>
              <LanguagePills
                valueTag={sessionLanguageTag}
                options={PRIMARY_LANGUAGE_OPTIONS}
                customLanguage={
                  PRIMARY_LANGUAGE_OPTIONS.some((option) => option.tag.toLowerCase() === sessionLanguageTag.toLowerCase())
                    ? null
                    : { tag: sessionLanguageTag, label: sessionLanguageLabel }
                }
                onChangeTag={(tag, label) => setSessionLanguage(tag, label)}
                onOpenOther={() => setLanguagePickerOpen(true)}
              />
            </div>
            {detectedLanguageSuggestion && !detectedLanguageSuggestion.dismissed && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                We detected {detectedLanguageSuggestion.label}. Switch?
                <div className="mt-2 flex gap-2">
                  <Button
                    className="bg-slate-700"
                    onClick={() => setSessionLanguage(detectedLanguageSuggestion.tag, detectedLanguageSuggestion.label)}
                  >
                    Switch
                  </Button>
                  <Button className="bg-slate-500" onClick={dismissDetectedLanguage}>
                    Keep {sessionLanguageLabel}
                  </Button>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-700">
              Input mode: {voiceInputMode === "handsfree" ? "Hands-free" : "Hold-to-talk"} | Device: {deviceLabel}
            </p>

            {canStart && (
              <Button onClick={startInterview} disabled={!isOnline || createInterviewMutation.isPending || tokenMutation.isPending}>
                Start interview
              </Button>
            )}

            {connectStalled && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                Connection is taking longer than expected.
                <div className="mt-2">
                  <Button className="bg-slate-600" onClick={startInterview}>
                    Retry connect
                  </Button>
                </div>
              </div>
            )}

            {currentQuestion && (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Current trait: <span className="font-semibold">{currentQuestion.traitName}</span>
              </p>
            )}

            {activeSession && (
              <div className="flex flex-wrap gap-2">
                <Button className="bg-slate-500" onClick={() => setVoicePhase(voicePhase === "paused" ? "listening" : "paused")}>
                  {voicePhase === "paused" ? "Resume" : "Pause"}
                </Button>
                <Button className="bg-slate-500" onClick={() => setVoiceInputMode(voiceInputMode === "handsfree" ? "hold_to_talk" : "handsfree")}>
                  {voiceInputMode === "handsfree" ? "Use hold-to-talk" : "Use hands-free"}
                </Button>
                {voiceInputMode === "hold_to_talk" && (
                  <Button
                    onMouseDown={() => {
                      if (voicePhase !== "paused") setVoicePhase("listening");
                      realtimeSessionRef.current?.setPushToTalk(true);
                    }}
                    onMouseUp={() => realtimeSessionRef.current?.setPushToTalk(false)}
                    onMouseLeave={() => realtimeSessionRef.current?.setPushToTalk(false)}
                    onTouchStart={() => {
                      if (voicePhase !== "paused") setVoicePhase("listening");
                      realtimeSessionRef.current?.setPushToTalk(true);
                    }}
                    onTouchEnd={() => realtimeSessionRef.current?.setPushToTalk(false)}
                    disabled={voicePhase === "paused"}
                  >
                    Hold to talk
                  </Button>
                )}
                <Button className="bg-red-700" onClick={endSession}>
                  End
                </Button>
              </div>
            )}

            {checkpointOpen && checkpoint && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{checkpoint.prompt}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button className="bg-slate-700" onClick={() => void handleCheckpointAction("stop")}>
                    Stop and review
                  </Button>
                  <Button onClick={() => void handleCheckpointAction("continue")}>Keep going</Button>
                  <Button className="bg-blue-700" onClick={() => void handleCheckpointAction("deepen")} disabled={!currentQuestion?.traitId}>
                    Go deeper on current trait
                  </Button>
                  <Button className="bg-slate-500" onClick={() => void handleCheckpointAction("focus")} disabled={checkpoint.suggestedTraitIds.length === 0}>
                    Focus trait area
                  </Button>
                </div>
              </div>
            )}

            {voicePhase === "ended" && (
              <div className="flex gap-2">
                <Button onClick={() => navigate("/widget/results")}>Review results</Button>
                <Button className="bg-slate-500" onClick={resetFlow}>
                  Start over
                </Button>
              </div>
            )}

            {!isOnline && <p className="text-sm text-red-700">You are offline. Reconnect to continue.</p>}
            {error && <p className="text-sm text-red-700">{error}</p>}
            {debugVoiceEnabled && (
              <div className="rounded-md border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">
                <p>
                  Debug voice: engine=<span className="font-semibold">{speechEngine}</span>
                </p>
                <p>
                  Minted voice=<span className="font-semibold">{lastMintedVoice ?? "(none)"}</span>
                </p>
                <p>
                  Language=<span className="font-semibold">{sessionLanguageTag}</span>
                </p>
              </div>
            )}
          </section>
          <LanguagePickerModal
            open={languagePickerOpen}
            options={EXTRA_LANGUAGE_OPTIONS}
            onClose={() => setLanguagePickerOpen(false)}
            onSelect={(tag, label) => {
              setSessionLanguage(tag, label);
              setLanguagePickerOpen(false);
            }}
          />
        </Card>
        <LiveInsightsSidebar
          snapshot={scoringSnapshot}
          programFit={programFit}
          activeTraitId={currentQuestion?.traitId ?? null}
          done={voicePhase === "ended"}
          onActiveTraitAction={(action) => void handleCheckpointAction(action)}
          activeTraitActionPending={checkpointMutation.isPending}
        />
      </div>
    </main>
  );
};

const ChatFlow = ({ mode, programFilterIds, onRestart }: { mode: InterviewMode; programFilterIds: string[]; onRestart: () => void }) => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [collectingPreferences, setCollectingPreferences] = useState(false);
  const [askedTraitIds, setAskedTraitIds] = useState<string[]>([]);
  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>([]);
  const isOnline = useOnlineStatus();

  const {
    transcript,
    sessionId,
    scoringSnapshot,
    programFit,
    sessionLanguageTag,
    setSessionId,
    addTranscriptTurn,
    setMode,
    setProgramFilterIds,
    setScoringSnapshot,
    setProgramFit,
    clear
  } =
    useWidgetStore();

  const createInterviewMutation = useMutation({
    mutationFn: () =>
      api.createInterviewSession({
        mode,
        language: sessionLanguageTag,
        programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
      })
  });
  const turnMutation = useMutation({
    mutationFn: (text: string) =>
      api.submitInterviewTurn(sessionId!, {
        mode,
        text,
        language: sessionLanguageTag,
        traitId: currentQuestion?.traitId,
        questionId: currentQuestion?.id,
        askedTraitIds,
        askedQuestionIds,
        programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
      })
  });

  useEffect(() => {
    clear();
    setMode(mode);
    setProgramFilterIds(programFilterIds);
  }, [clear, mode, programFilterIds, setMode, setProgramFilterIds]);

  const startInterview = async () => {
    try {
      const session = await createInterviewMutation.mutateAsync();
      const id = session.sessionId;
      if (!id) throw new Error("Session id missing");
      setSessionId(id);
      setScoringSnapshot(session.scoring_snapshot ?? null);
      setProgramFit(session.program_fit ?? null);
      setStarted(true);
      setCurrentQuestion(null);
      if (session.nextQuestion) {
        const onboardingText = session.initialPrompt ? `${session.initialPrompt} ${interestOnboardingPrompt}` : interestOnboardingPrompt;
        setCollectingPreferences(true);
        addTranscriptTurn({ id: transcriptId("assistant"), speaker: "assistant", text: onboardingText, ts: new Date().toISOString() });
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not start chat interview.");
    }
  };

  const submitAnswer = async () => {
    const answer = input.trim();
    if (!answer || (!currentQuestion && !collectingPreferences)) return;
    setInput("");
    addTranscriptTurn({ id: transcriptId("candidate"), speaker: "candidate", text: answer, ts: new Date().toISOString() });
    if (currentQuestion) {
      setAskedTraitIds((prev) => [...prev, currentQuestion.traitId]);
      setAskedQuestionIds((prev) => [...prev, currentQuestion.id]);
    }

    try {
      const result = await turnMutation.mutateAsync(answer);
      setScoringSnapshot(result.scoring_snapshot);
      setProgramFit(result.program_fit);
      if (collectingPreferences) {
        setCollectingPreferences(false);
      }
      if (result.nextQuestion) {
        setCurrentQuestion(result.nextQuestion);
        addTranscriptTurn({
          id: transcriptId("assistant"),
          speaker: "assistant",
          text: result.nextQuestion.prompt,
          ts: new Date().toISOString()
        });
      } else {
        await api.completeSession(sessionId!);
        navigate("/widget/results");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit answer.");
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Chat Interview</h2>
            {!started && (
              <div className="flex gap-2">
                <Button onClick={startInterview} disabled={!isOnline || createInterviewMutation.isPending}>
                  Start chat
                </Button>
                <Button className="bg-slate-500" onClick={onRestart}>
                  Back
                </Button>
              </div>
            )}
            {started && (
              <>
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                  {transcript.map((turn) => (
                    <div key={`${turn.id}-${turn.ts}`} className={`rounded p-2 text-sm ${turn.speaker === "candidate" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`}>
                      <span className="font-semibold capitalize">{turn.speaker}:</span> {turn.text}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitAnswer();
                      }
                    }}
                    placeholder="Type your answer"
                  />
                  <Button onClick={submitAnswer} disabled={!isOnline || turnMutation.isPending}>
                    Send
                  </Button>
                </div>
              </>
            )}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </section>
        </Card>
        <LiveInsightsSidebar snapshot={scoringSnapshot} programFit={programFit} activeTraitId={currentQuestion?.traitId ?? null} />
      </div>
    </main>
  );
};

const QuizFlow = ({ mode, programFilterIds, onRestart }: { mode: InterviewMode; programFilterIds: string[]; onRestart: () => void }) => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionDirection, setQuestionDirection] = useState<"forward" | "back">("forward");
  const [collectingPreferences, setCollectingPreferences] = useState(false);
  const [preferenceInput, setPreferenceInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [surpriseKey, setSurpriseKey] = useState<string | null>(null);
  const [surpriseVariant, setSurpriseVariant] = useState<"confetti" | "spark" | "pulse" | "none">("none");
  const [rankingUpdating, setRankingUpdating] = useState(false);
  const [rankingPulseToken, setRankingPulseToken] = useState<number | null>(null);
  const [streakMessage, setStreakMessage] = useState<string | null>(null);
  const [quizExperience, setQuizExperience] = useState<{
    headline: string;
    subheadline: string;
    estimatedTimeLabel: string;
  } | null>(null);
  const [askedTraitIds, setAskedTraitIds] = useState<string[]>([]);
  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>([]);
  const isOnline = useOnlineStatus();
  const prefersReducedMotion = usePrefersReducedMotion();

  const {
    sessionId,
    scoringSnapshot,
    programFit,
    sessionLanguageTag,
    setSessionId,
    addTranscriptTurn,
    setMode,
    setProgramFilterIds,
    setScoringSnapshot,
    setProgramFit,
    clear
  } =
    useWidgetStore();

  const createInterviewMutation = useMutation({
    mutationFn: () =>
      api.createInterviewSession({
        mode,
        language: sessionLanguageTag,
        programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
      })
  });
  const turnMutation = useMutation({
    mutationFn: (text: string) =>
      api.submitInterviewTurn(sessionId!, {
        mode,
        text,
        language: sessionLanguageTag,
        traitId: currentQuestion?.traitId,
        questionId: currentQuestion?.id,
        askedTraitIds,
        askedQuestionIds,
        programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
      })
  });

  useEffect(() => {
    clear();
    setMode(mode);
    setProgramFilterIds(programFilterIds);
  }, [clear, mode, programFilterIds, setMode, setProgramFilterIds]);

  useEffect(() => {
    let cancelled = false;
    void api
      .getQuizExperienceConfig()
      .then((payload) => {
        if (cancelled) return;
        setQuizExperience({
          headline: payload.data.headline,
          subheadline: payload.data.subheadline,
          estimatedTimeLabel: payload.data.estimatedTimeLabel
        });
      })
      .catch(() => {
        if (cancelled) return;
        setQuizExperience({
          headline: "Discover your best-fit graduate path",
          subheadline: "A quick, personality-first quiz to see where you thrive.",
          estimatedTimeLabel: "3-5 min"
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startQuiz = async () => {
    try {
      const session = await createInterviewMutation.mutateAsync();
      const id = session.sessionId;
      if (!id) throw new Error("Session id missing");
      setSessionId(id);
      setScoringSnapshot(session.scoring_snapshot ?? null);
      setProgramFit(session.program_fit ?? null);
      setStarted(true);
      setCurrentQuestion(null);
      if (session.nextQuestion) {
        const onboardingText = session.initialPrompt ? `${session.initialPrompt} ${interestOnboardingPrompt}` : interestOnboardingPrompt;
        setCollectingPreferences(true);
        addTranscriptTurn({ id: transcriptId("assistant"), speaker: "assistant", text: onboardingText, ts: new Date().toISOString() });
      }
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start quiz.");
    }
  };

  const submitPreferenceProfile = async () => {
    const answer = preferenceInput.trim();
    if (!answer || !collectingPreferences) return;
    setPreferenceInput("");
    addTranscriptTurn({ id: transcriptId("candidate"), speaker: "candidate", text: answer, ts: new Date().toISOString() });
    try {
      const result = await turnMutation.mutateAsync(answer);
      setScoringSnapshot(result.scoring_snapshot);
      setProgramFit(result.program_fit);
      setCollectingPreferences(false);
      if (result.nextQuestion) {
        setQuestionDirection("forward");
        setCurrentQuestion(result.nextQuestion);
      } else {
        await api.completeSession(sessionId!);
        navigate("/widget/results");
      }
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Could not submit your preferences.");
    }
  };

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const selectAnswer = async (answer: string) => {
    if (!currentQuestion || selectionLocked || turnMutation.isPending) return;
    const nextAnswerCount = askedQuestionIds.length + 1;
    const triggerKey = `${sessionId ?? "local"}::${currentQuestion.id}::${answer}::${Date.now()}`;
    const variant = pickSurpriseVariant(currentQuestion.id, sessionId ?? null, prefersReducedMotion);

    setSelectedOption(answer);
    setSelectionLocked(true);
    setSurpriseKey(triggerKey);
    setSurpriseVariant(variant);
    if (nextAnswerCount % 3 === 0) {
      setStreakMessage("Nice - you're on a roll.");
      window.setTimeout(() => setStreakMessage(null), 900);
    }

    await wait(prefersReducedMotion ? 120 : 360);
    setRankingUpdating(true);

    addTranscriptTurn({ id: transcriptId("candidate"), speaker: "candidate", text: answer, ts: new Date().toISOString() });
    setAskedTraitIds((prev) => [...prev, currentQuestion.traitId]);
    setAskedQuestionIds((prev) => [...prev, currentQuestion.id]);
    const startedAt = Date.now();
    try {
      const result = await turnMutation.mutateAsync(answer);
      const elapsed = Date.now() - startedAt;
      const rankingDelayMs = prefersReducedMotion ? 0 : 480;
      if (elapsed < rankingDelayMs) {
        await wait(rankingDelayMs - elapsed);
      }

      setScoringSnapshot(result.scoring_snapshot);
      setProgramFit(result.program_fit);
      if (variant === "pulse" && !prefersReducedMotion) {
        setRankingPulseToken(Date.now());
      }
      if (result.nextQuestion) {
        setQuestionDirection("forward");
        setCurrentQuestion(result.nextQuestion);
      } else {
        await api.completeSession(sessionId!);
        navigate("/widget/results");
      }
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Could not submit quiz answer.");
    } finally {
      setRankingUpdating(false);
      setSelectionLocked(false);
      setSelectedOption(null);
      if (prefersReducedMotion) {
        setSurpriseKey(null);
        setSurpriseVariant("none");
      } else {
        window.setTimeout(() => {
          setSurpriseKey(null);
          setSurpriseVariant("none");
        }, 680);
      }
    }
  };

  const totalTraits = scoringSnapshot?.traits.length ?? 0;
  const completedTraits = (scoringSnapshot?.traits ?? []).filter((trait) => trait.status === "complete").length;
  const progressLabel = totalTraits > 0 ? `${Math.min(completedTraits + (currentQuestion ? 1 : 0), totalTraits)} / ${totalTraits}` : null;
  const optionMetaByLabel = new Map(
    ((currentQuestion?.answerOptionsMeta as Array<{ label?: string; microCopy?: string; iconToken?: string }> | undefined) ?? [])
      .filter((item) => typeof item?.label === "string")
      .map((item) => [String(item.label), item] as const)
  );
  const traitDisplayName = currentQuestion?.publicLabel ?? currentQuestion?.traitName;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Quiz</h2>
            {!started && (
              <div className="quiz-intro-panel space-y-4 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{quizExperience?.estimatedTimeLabel ?? "3-5 min"}</p>
                <h3 className="text-2xl font-bold text-slate-900">{quizExperience?.headline ?? "Discover your best-fit graduate path"}</h3>
                <p className="text-sm text-slate-700">{quizExperience?.subheadline ?? "A quick, personality-first quiz to see where you thrive."}</p>
                <div className="flex gap-2">
                  <Button onClick={startQuiz} disabled={!isOnline || createInterviewMutation.isPending}>
                    Start
                  </Button>
                  <Button className="bg-slate-500" onClick={onRestart}>
                    Back
                  </Button>
                </div>
              </div>
            )}
            {started && collectingPreferences && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Tell us your interests and favorite skills</p>
                <p className="text-sm text-slate-700">
                  Share what you are most interested in studying and which skills you enjoy using. We will tailor the quiz flow from this.
                </p>
                <textarea
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  rows={4}
                  value={preferenceInput}
                  onChange={(event) => setPreferenceInput(event.target.value)}
                  placeholder="Example: I enjoy data storytelling, dashboards, and solving business problems with SQL and Python."
                />
                <div className="flex gap-2">
                  <Button onClick={() => void submitPreferenceProfile()} disabled={!isOnline || turnMutation.isPending || preferenceInput.trim().length === 0}>
                    Continue
                  </Button>
                </div>
              </div>
            )}
            {started && currentQuestion && (
              <SwipeTransition activeKey={currentQuestion.id} direction={questionDirection} reducedMotion={prefersReducedMotion} className="space-y-4">
                <div className="relative space-y-4">
                  <SurpriseAnimationLayer triggerKey={surpriseKey} variant={surpriseVariant} reducedMotion={prefersReducedMotion} />
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{traitDisplayName}</p>
                    {progressLabel && <p className="quiz-progress-pill text-xs font-semibold">Progress: {progressLabel}</p>}
                  </div>
                  {streakMessage && <p className="quiz-streak-badge text-xs font-semibold">{streakMessage}</p>}
                  {currentQuestion.narrativeIntro && <p className="text-sm text-slate-600">{currentQuestion.narrativeIntro}</p>}
                  <h3 className="text-lg font-semibold text-slate-900">{currentQuestion.prompt}</h3>
                  <div className="grid gap-2">
                    {currentQuestion.options.map((option: string) => {
                      const isSelected = selectedOption === option;
                      return (
                        <button
                          key={`${currentQuestion.id}-${option}`}
                          type="button"
                          className={`quiz-answer-card rounded-xl border px-4 py-3 text-left text-sm shadow-sm transition ${
                            isSelected ? "quiz-answer-card-selected" : "quiz-answer-card-idle"
                          } ${isSelected && surpriseVariant === "spark" && !prefersReducedMotion ? "quiz-answer-card-spark" : ""}`}
                          onClick={() => void selectAnswer(option)}
                          disabled={!isOnline || turnMutation.isPending || selectionLocked}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{option}</p>
                              {optionMetaByLabel.get(option)?.microCopy && (
                                <p className="mt-1 text-xs text-slate-600">{optionMetaByLabel.get(option)?.microCopy}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="quiz-option-chip rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                                {(optionMetaByLabel.get(option)?.iconToken ?? "spark").slice(0, 10)}
                              </span>
                              <span className={`quiz-option-check ${isSelected ? "quiz-option-check-visible" : ""}`} aria-hidden="true">
                                ✓
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SwipeTransition>
            )}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </section>
        </Card>
        <LiveInsightsSidebar
          snapshot={scoringSnapshot}
          programFit={programFit}
          activeTraitId={currentQuestion?.traitId ?? null}
          updatingMatches={rankingUpdating}
          reducedMotion={prefersReducedMotion}
          rankingPulseToken={rankingPulseToken}
        />
      </div>
    </main>
  );
};

const ResultsPage = () => {
  const navigate = useNavigate();
  const scorecard = useWidgetStore((state) => state.scorecard);
  const scoringSnapshot = useWidgetStore((state) => state.scoringSnapshot);
  const programFit = useWidgetStore((state) => state.programFit);
  const mode = useWidgetStore((state) => state.mode);
  const sessionId = useWidgetStore((state) => state.sessionId);
  const programId = useWidgetStore((state) => state.programId);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<"email" | "sms" | "phone">("email");
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadValidationError, setLeadValidationError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const createLeadMutation = useMutation({
    mutationFn: () =>
      api.createPublicLead({
        firstName,
        lastName,
        email,
        phone,
        preferredChannel,
        programId: programId ?? undefined,
        sessionId: sessionId ?? undefined
      }),
    onSuccess: () => {
      setLeadValidationError(null);
      setLeadSubmitted(true);
    }
  });

  const submitLead = () => {
    if (!email.trim()) {
      setLeadValidationError("Email is required.");
      return;
    }
    if (!emailPattern.test(email.trim())) {
      setLeadValidationError("Enter a valid email address.");
      return;
    }
    if (!isOnline) {
      setLeadValidationError("You are offline. Reconnect and retry.");
      return;
    }

    setLeadValidationError(null);
    createLeadMutation.mutate();
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <h2 className="mb-3 text-2xl font-semibold">Results</h2>
          <p className="text-sm text-slate-700">Interview mode: {mode?.toUpperCase() ?? "N/A"}</p>
          {scorecard && <p className="text-sm text-slate-700">Overall score: {scorecard.overallScore.toFixed(2)} / 5.00</p>}
          {!scorecard && <p className="text-sm text-slate-600">Review rankings and trait evidence in the side panel.</p>}

          <div className="mt-4 rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-900">Request Info / Talk to an advisor</p>
            {!leadSubmitted && (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={preferredChannel} onChange={(event) => setPreferredChannel(event.target.value as "email" | "sms" | "phone")}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="phone">Phone</option>
                </select>
                <Button onClick={submitLead} disabled={createLeadMutation.isPending}>
                  {createLeadMutation.isPending ? "Submitting..." : "Request Info"}
                </Button>
                {leadValidationError && <p className="text-sm text-red-700">{leadValidationError}</p>}
              </div>
            )}
            {leadSubmitted && <p className="text-sm text-emerald-700">Thanks - we&apos;ll reach out soon.</p>}
          </div>

          <Button className="mt-4 bg-slate-500" onClick={() => navigate("/widget")}>
            Start over
          </Button>
        </Card>
        <LiveInsightsSidebar snapshot={scoringSnapshot} programFit={programFit} done />
      </div>
    </main>
  );
};

const router = createBrowserRouter(
  [
    { path: "/", element: <Navigate to="/widget" replace /> },
    { path: "/widget", element: <WidgetSetup /> },
    { path: "/widget/results", element: <ResultsPage /> }
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      ...( { v7_startTransition: true } as Record<string, boolean>)
    }
  }
);

const container = document.getElementById("root")!;
const root =
  (container as unknown as { _widgetRoot?: ReturnType<typeof ReactDOM.createRoot> })._widgetRoot ??
  ((container as unknown as { _widgetRoot?: ReturnType<typeof ReactDOM.createRoot> })._widgetRoot =
    ReactDOM.createRoot(container));

const WidgetRuntime = () => {
  const [tokens, setTokens] = useState<WidgetTheme["tokens"]>(defaultWidgetThemeTokens);

  useEffect(() => {
    let cancelled = false;
    const loadTheme = async () => {
      try {
        const payload = await api.getPublicWidgetTheme(widgetThemeVariantFromUrl());
        if (!cancelled && payload.data?.tokens) {
          setTokens(payload.data.tokens);
        }
      } catch {
        if (!cancelled) {
          setTokens(defaultWidgetThemeTokens);
        }
      }
    };
    void loadTheme();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pm-theme-root min-h-screen" style={themeCssVars(tokens)}>
      <RouterProvider router={router} />
    </div>
  );
};

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WidgetRuntime />
    </QueryClientProvider>
  </React.StrictMode>
);

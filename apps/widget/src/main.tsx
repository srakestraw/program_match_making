import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Button, Card } from "@pmm/ui";
import { createApiClient, type ProgramFit, type ScoringSnapshot } from "@pmm/api-client";
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
import "./styles.css";

const queryClient = new QueryClient();
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000" });

type InterviewMode = "voice" | "chat" | "quiz";

const modeOptions: Array<{ id: InterviewMode; label: string; description: string }> = [
  { id: "voice", label: "Voice", description: "Live conversational interview" },
  { id: "chat", label: "Chat", description: "Trait-driven text interview" },
  { id: "quiz", label: "Quiz", description: "Structured trait questions" }
];

const parseModeParam = (value: string | null): InterviewMode | null => {
  if (value === "voice" || value === "chat" || value === "quiz") return value;
  return null;
};

const transcriptId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const LiveInsightsSidebar = ({
  snapshot,
  programFit,
  activeTraitId,
  done = false
}: {
  snapshot: ScoringSnapshot | null;
  programFit: ProgramFit | null;
  activeTraitId?: string | null;
  done?: boolean;
}) => (
  <aside className="space-y-3">
    <TraitScorePanel traits={snapshot?.traits ?? []} activeTraitId={activeTraitId ?? null} done={done} />
    <ProgramFloatField programs={programFit?.programs ?? []} selectedProgramId={programFit?.selectedProgramId ?? null} done={done} />
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

  const clear = useWidgetStore((state) => state.clear);
  const setMode = useWidgetStore((state) => state.setMode);
  const setProgramId = useWidgetStore((state) => state.setProgramId);
  const setProgramFilterIds = useWidgetStore((state) => state.setProgramFilterIds);

  useEffect(() => {
    if (queryMode) setSelectedMode(queryMode);
  }, [queryMode]);

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
              <div className="grid gap-2 sm:grid-cols-3">
                {modeOptions.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`rounded-md border p-3 text-left ${selectedMode === mode.id ? "border-slate-900 bg-slate-100" : "border-slate-200"}`}
                    onClick={() => setSelectedMode(mode.id)}
                  >
                    <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
                    <p className="text-xs text-slate-600">{mode.description}</p>
                  </button>
                ))}
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
  const [askedTraitIds, setAskedTraitIds] = useState<string[]>([]);
  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>([]);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [connectStalled, setConnectStalled] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);

  const realtimeSessionRef = useRef<RealtimeSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const lastCandidateTurnIdRef = useRef<string | null>(null);
  const kickoffStartedRef = useRef(false);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
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
    if (!realtimeSessionRef.current) return;
    if (!isConnectedPhase(voicePhase)) return;
    realtimeSessionRef.current.updateInstructions(
      `You are a warm admissions interviewer. Respond in ${sessionLanguageLabel} only. Do not switch languages unless the user explicitly asks.`
    );
  }, [sessionLanguageTag, sessionLanguageLabel, voicePhase]);

  const tokenMutation = useMutation({
    mutationFn: (input?: { brandVoiceId?: string; voiceName?: string; language?: string }) => api.getRealtimeToken(input)
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
    mutationFn: (action: "stop" | "continue" | "focus") =>
      api.submitInterviewCheckpoint(sessionIdRef.current!, {
        mode,
        action,
        focusTraitIds: action === "focus" ? checkpoint?.suggestedTraitIds : undefined,
        askedTraitIds,
        askedQuestionIds,
        programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
      })
  });

  const speakPrompt = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      transitionPhase("assistant_done");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = createLanguageUtterance(text, sessionLanguageTag, window.speechSynthesis.getVoices?.() ?? []);
    speechSynthesisRef.current = utterance;
    utterance.onstart = () => {
      debugVoice("tts.start", { chars: text.length });
      setVoicePhase("speaking");
    };
    utterance.onend = () => {
      debugVoice("tts.end");
      transitionPhase("assistant_done");
    };
    utterance.onerror = () => {
      transitionPhase("assistant_done");
    };
    window.speechSynthesis.speak(utterance);
  };

  const pushAssistantQuestion = async (question: any, prefix?: string) => {
    if (!question) return;
    setCurrentQuestion(question);
    setAskedQuestionIds((prev) => (prev.includes(question.id) ? prev : [...prev, question.id]));
    setAskedTraitIds((prev) => (prev[prev.length - 1] === question.traitId ? prev : [...prev, question.traitId]));
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
      await pushAssistantQuestion(interview.nextQuestion, interview.initialPrompt);
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
    if (turn.speaker !== "candidate") {
      return;
    }
    if (voicePhase !== "listening") return;
    if (lastCandidateTurnIdRef.current === turn.id) return;
    lastCandidateTurnIdRef.current = turn.id;

    addTranscriptTurn(turn);
    debugVoice("transcript.candidate", { chars: turn.text.length });
    if (/\b(hola|gracias|por favor|buenos|buenas|adios)\b/i.test(turn.text)) {
      setDetectedLanguage("es", "Spanish");
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
      if (result.checkpoint?.required) {
        setCheckpointOpen(true);
        setVoicePhase("paused");
        return;
      }
      if (result.nextQuestion) {
        await pushAssistantQuestion(result.nextQuestion);
      } else {
        setVoicePhase("ended");
      }
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : "Could not score voice turn.");
      setVoicePhase("error");
    }
  };

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
      const token = await tokenMutation.mutateAsync({
        brandVoiceId: interview.brandVoiceId ?? undefined,
        language: interview.language ?? sessionLanguageTag
      });
      const id = interview.sessionId;
      if (!id) throw new Error("Session id missing");
      setSessionId(id);
      sessionIdRef.current = id;
      debugVoice("session.ready", { sessionId: id });

      const realtimeSession = new RealtimeSession({
        onStateChange: (state) => {
          setTransportState(state);
          debugVoice("transport.state", { state });
          if (state === "disconnected" && isConnectedPhase(useWidgetStore.getState().voicePhase)) {
            setError("Connection dropped. Retry connection.");
            setVoicePhase("error");
          }
        },
        onTranscriptTurn
      });
      realtimeSession.setAudioTrack(track);
      realtimeSessionRef.current = realtimeSession;
      await realtimeSession.connect(token.client_secret.value);
      realtimeSession.updateInstructions(
        interview.systemPrompt ??
          `You are a warm admissions interviewer. Respond in ${sessionLanguageLabel} only. Do not switch languages unless the user explicitly asks.`
      );
      transitionPhase("transport_connected");
      await kickoffIfNeeded(interview);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start voice interview.");
      setVoicePhase("error");
    }
  };

  const handleCheckpointAction = async (action: "stop" | "continue" | "focus") => {
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
      window.speechSynthesis?.cancel();
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
    await realtimeSessionRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
    clear();
    setTransportState("idle");
    setError(null);
    setCheckpointOpen(false);
    setCurrentQuestion(null);
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

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
              {transcript.length === 0 && <p className="text-sm text-slate-500">Transcript appears as the conversation runs.</p>}
              {transcript.map((turn) => (
                <div key={`${turn.id}-${turn.ts}`} className="rounded bg-slate-50 p-2 text-sm">
                  <span className="font-semibold capitalize">{turn.speaker}:</span> {turn.text}
                </div>
              ))}
            </div>

            {checkpointOpen && checkpoint && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{checkpoint.prompt}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button className="bg-slate-700" onClick={() => void handleCheckpointAction("stop")}>
                    Stop and review
                  </Button>
                  <Button onClick={() => void handleCheckpointAction("continue")}>Keep going</Button>
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
        <LiveInsightsSidebar snapshot={scoringSnapshot} programFit={programFit} activeTraitId={currentQuestion?.traitId ?? null} done={voicePhase === "ended"} />
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
      setCurrentQuestion(session.nextQuestion ?? null);
      if (session.nextQuestion) {
        addTranscriptTurn({ id: transcriptId("assistant"), speaker: "assistant", text: session.nextQuestion.prompt, ts: new Date().toISOString() });
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not start chat interview.");
    }
  };

  const submitAnswer = async () => {
    const answer = input.trim();
    if (!answer || !currentQuestion) return;
    setInput("");
    addTranscriptTurn({ id: transcriptId("candidate"), speaker: "candidate", text: answer, ts: new Date().toISOString() });
    setAskedTraitIds((prev) => [...prev, currentQuestion.traitId]);
    setAskedQuestionIds((prev) => [...prev, currentQuestion.id]);

    try {
      const result = await turnMutation.mutateAsync(answer);
      setScoringSnapshot(result.scoring_snapshot);
      setProgramFit(result.program_fit);
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
  const [askedTraitIds, setAskedTraitIds] = useState<string[]>([]);
  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>([]);
  const isOnline = useOnlineStatus();

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

  const startQuiz = async () => {
    try {
      const session = await createInterviewMutation.mutateAsync();
      const id = session.sessionId;
      if (!id) throw new Error("Session id missing");
      setSessionId(id);
      setScoringSnapshot(session.scoring_snapshot ?? null);
      setProgramFit(session.program_fit ?? null);
      setStarted(true);
      setCurrentQuestion(session.nextQuestion ?? null);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start quiz.");
    }
  };

  const selectAnswer = async (answer: string) => {
    if (!currentQuestion) return;
    addTranscriptTurn({ id: transcriptId("candidate"), speaker: "candidate", text: answer, ts: new Date().toISOString() });
    setAskedTraitIds((prev) => [...prev, currentQuestion.traitId]);
    setAskedQuestionIds((prev) => [...prev, currentQuestion.id]);
    try {
      const result = await turnMutation.mutateAsync(answer);
      setScoringSnapshot(result.scoring_snapshot);
      setProgramFit(result.program_fit);
      if (result.nextQuestion) {
        setCurrentQuestion(result.nextQuestion);
      } else {
        await api.completeSession(sessionId!);
        navigate("/widget/results");
      }
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Could not submit quiz answer.");
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Quiz</h2>
            {!started && (
              <div className="flex gap-2">
                <Button onClick={startQuiz} disabled={!isOnline || createInterviewMutation.isPending}>
                  Start quiz
                </Button>
                <Button className="bg-slate-500" onClick={onRestart}>
                  Back
                </Button>
              </div>
            )}
            {started && currentQuestion && (
              <>
                <h3 className="text-lg font-semibold text-slate-900">{currentQuestion.prompt}</h3>
                <div className="grid gap-2">
                  {currentQuestion.options.map((option: string) => (
                    <button
                      key={`${currentQuestion.id}-${option}`}
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-left text-sm hover:border-slate-900"
                      onClick={() => void selectAnswer(option)}
                      disabled={!isOnline || turnMutation.isPending}
                    >
                      {option}
                    </button>
                  ))}
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

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/widget" replace />} />
      <Route path="/widget" element={<WidgetSetup />} />
      <Route path="/widget/results" element={<ResultsPage />} />
    </Routes>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

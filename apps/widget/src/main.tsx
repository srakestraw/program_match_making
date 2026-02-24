import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card } from "@pmm/ui";
import { createApiClient, type ProgramQuestion, type PublicProgram, type TranscriptTurnInput } from "@pmm/api-client";
import { RealtimeSession, type ConnectionState, type TranscriptTurn } from "@pmm/voice";
import { useWidgetStore } from "./store";
import "./styles.css";

const queryClient = new QueryClient();
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000" });

type InterviewMode = "voice" | "chat" | "quiz";
type VoiceStep = "start" | "permissions" | "session" | "end";

const bucketOrder = ["CRITICAL", "VERY_IMPORTANT", "IMPORTANT", "NICE_TO_HAVE"] as const;
const bucketWeight: Record<(typeof bucketOrder)[number], number> = {
  CRITICAL: 1,
  VERY_IMPORTANT: 0.8,
  IMPORTANT: 0.6,
  NICE_TO_HAVE: 0.4
};

const modeOptions: Array<{ id: InterviewMode; label: string; description: string }> = [
  { id: "voice", label: "Voice", description: "Live voice interview" },
  { id: "chat", label: "Chat", description: "Text-based interview" },
  { id: "quiz", label: "Quiz", description: "Multiple choice assessment" }
];

const transcriptId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const toTurnInput = (turns: TranscriptTurn[]) => turns.map((turn) => ({ ts: turn.ts, speaker: turn.speaker, text: turn.text }));

const parseModeParam = (value: string | null): InterviewMode | null => {
  if (value === "voice" || value === "chat" || value === "quiz") {
    return value;
  }

  return null;
};

const sanitizeOptionLabel = (option: string) => option.replace(/\s*\[[0-5](?:\.\d+)?\]\s*$/g, "").replace(/\s*\([0-5](?:\.\d+)?\)\s*$/g, "").trim();
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

const WidgetSetup = () => {
  const [searchParams] = useSearchParams();

  const queryMode = parseModeParam(searchParams.get("mode"));
  const lockMode = queryMode !== null || ["1", "true", "yes"].includes((searchParams.get("lockMode") ?? "").toLowerCase());
  const queryProgramId = searchParams.get("programId");

  const [selectedMode, setSelectedMode] = useState<InterviewMode | null>(queryMode);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(queryProgramId ?? "");
  const [started, setStarted] = useState(false);

  const clear = useWidgetStore((state) => state.clear);
  const setMode = useWidgetStore((state) => state.setMode);
  const setProgramId = useWidgetStore((state) => state.setProgramId);

  const programsQuery = useQuery({
    queryKey: ["public-programs"],
    queryFn: async () => {
      const response = await api.getPublicPrograms();
      return response.data;
    }
  });

  useEffect(() => {
    if (queryMode) {
      setSelectedMode(queryMode);
    }
  }, [queryMode]);

  useEffect(() => {
    if (queryProgramId) {
      setSelectedProgramId(queryProgramId);
    }
  }, [queryProgramId]);

  const selectedProgram = useMemo(
    () => programsQuery.data?.find((program) => program.id === selectedProgramId) ?? null,
    [programsQuery.data, selectedProgramId]
  );

  const canStart = Boolean(selectedMode && selectedProgramId);

  if (started && selectedMode && selectedProgramId) {
    if (selectedMode === "voice") {
      return <VoiceFlow programId={selectedProgramId} onRestart={() => setStarted(false)} />;
    }

    if (selectedMode === "chat") {
      return <ChatFlow programId={selectedProgramId} onRestart={() => setStarted(false)} />;
    }

    return <QuizFlow programId={selectedProgramId} onRestart={() => setStarted(false)} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card>
        <section className="space-y-4">
          <h1 className="text-3xl font-bold">Program Match Interview</h1>
          <p className="text-sm text-slate-600">Select your interview mode and program to begin.</p>

          {!lockMode && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Mode</p>
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

          {!queryProgramId && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800" htmlFor="program-select">
                Program
              </label>
              <select
                id="program-select"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={selectedProgramId}
                onChange={(event) => setSelectedProgramId(event.target.value)}
                disabled={programsQuery.isLoading}
              >
                <option value="">Select a program</option>
                {(programsQuery.data ?? []).map((program: PublicProgram) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {queryProgramId && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              Program locked to: {selectedProgram?.name ?? queryProgramId}
            </p>
          )}

          <Button
            disabled={!canStart}
            onClick={() => {
              clear();
              setMode(selectedMode);
              setProgramId(selectedProgramId);
              setStarted(true);
            }}
          >
            Start
          </Button>
          {programsQuery.error && <p className="text-sm text-red-700">Failed to load programs.</p>}
        </section>
      </Card>
    </main>
  );
};

const VoiceFlow = ({ programId, onRestart }: { programId: string; onRestart: () => void }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<VoiceStep>("start");
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [micReady, setMicReady] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState("Unknown microphone");

  const realtimeSessionRef = useRef<RealtimeSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const stepRef = useRef<VoiceStep>("start");
  const isOnline = useOnlineStatus();

  const { sessionId, transcript, setSessionId, addTranscriptTurn, setProgramId, setMode, setScorecard, clear } = useWidgetStore();

  const createSessionMutation = useMutation({ mutationFn: () => api.createSession("voice", { programId }) });
  const tokenMutation = useMutation({ mutationFn: api.getRealtimeToken });
  const appendTranscriptMutation = useMutation({
    mutationFn: ({ id, turns }: { id: string; turns: Array<{ ts: string; speaker: "candidate" | "assistant"; text: string }> }) =>
      api.appendTranscript(id, turns)
  });
  const completeSessionMutation = useMutation({ mutationFn: (id: string) => api.completeSession(id) });

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    setProgramId(programId);
    setMode("voice");
    setScorecard(null);
  }, [programId, setMode, setProgramId, setScorecard]);

  const startPermissionCheck = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const [track] = stream.getAudioTracks();
      setDeviceLabel(track.label || "Microphone ready");
      setMicReady(true);
      setStep("permissions");
    } catch {
      setError("Microphone access denied. Please allow mic permissions and retry.");
      setStep("permissions");
    }
  };

  const onTranscriptTurn = (turn: TranscriptTurn) => {
    addTranscriptTurn(turn);
    const id = useWidgetStore.getState().sessionId;
    if (id) {
      void appendTranscriptMutation.mutateAsync({
        id,
        turns: [{ ts: turn.ts, speaker: turn.speaker, text: turn.text }]
      });
    }
  };

  const connectRealtime = async () => {
    if (!mediaStreamRef.current || !micReady) {
      setError("Microphone is not ready.");
      return;
    }

    setError(null);

    try {
      const [createdSession, token] = await Promise.all([createSessionMutation.mutateAsync(), tokenMutation.mutateAsync()]);

      setSessionId(createdSession.id);
      const track = mediaStreamRef.current.getAudioTracks()[0];

      const realtimeSession = new RealtimeSession({
        onStateChange: (state) => {
          setConnectionState(state);
          if (state === "disconnected" && stepRef.current === "session") {
            setError("Connection dropped. You can retry the realtime connection.");
          }
        },
        onTranscriptTurn
      });

      realtimeSession.setAudioTrack(track);
      realtimeSessionRef.current = realtimeSession;
      await realtimeSession.connect(token.client_secret.value);
      setStep("session");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Failed to start voice session.");
      setConnectionState("error");
    }
  };

  const endSession = async () => {
    try {
      await realtimeSessionRef.current?.disconnect();
      if (sessionId) {
        await completeSessionMutation.mutateAsync(sessionId);
      }
    } catch {
      setError("Session ended with errors. Transcript was kept locally.");
    } finally {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      setStep("end");
    }
  };

  const resetFlow = async () => {
    await realtimeSessionRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    setSessionId(null);
    clear();
    setProgramId(programId);
    setMode("voice");
    setConnectionState("idle");
    setMicReady(false);
    setError(null);
    setStep("start");
    onRestart();
  };

  const statusLabel = useMemo(() => {
    if (connectionState === "connected") return "Connected";
    if (connectionState === "connecting") return "Connecting";
    if (connectionState === "disconnected") return "Disconnected";
    if (connectionState === "error") return "Error";
    return "Idle";
  }, [connectionState]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card>
        {step === "start" && (
          <section className="space-y-4">
            <h1 className="text-3xl font-bold">Voice Interview</h1>
            <p className="text-sm text-slate-600">
              We only capture your interview audio and transcript for evaluation. Click start when you are ready.
            </p>
            <Button onClick={startPermissionCheck}>Start voice interview</Button>
          </section>
        )}

        {step === "permissions" && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Mic and device check</h2>
            <p className="text-sm text-slate-700">Device: {deviceLabel}</p>
            <p className="text-sm text-slate-700">Permission: {micReady ? "Granted" : "Not granted"}</p>
            <div className="flex gap-2">
              <Button onClick={connectRealtime} disabled={!isOnline || !micReady || createSessionMutation.isPending || tokenMutation.isPending}>
                Continue to interview
              </Button>
              <Button className="bg-slate-500" onClick={startPermissionCheck}>
                Retry device check
              </Button>
            </div>
          </section>
        )}

        {step === "session" && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">In-session voice</h2>
            <p className="text-sm text-slate-700">Connection status: {statusLabel}</p>
            <div className="flex gap-2">
              <Button
                onMouseDown={() => realtimeSessionRef.current?.setPushToTalk(true)}
                onMouseUp={() => realtimeSessionRef.current?.setPushToTalk(false)}
                onMouseLeave={() => realtimeSessionRef.current?.setPushToTalk(false)}
                onTouchStart={() => realtimeSessionRef.current?.setPushToTalk(true)}
                onTouchEnd={() => realtimeSessionRef.current?.setPushToTalk(false)}
                disabled={!isOnline || connectionState !== "connected"}
              >
                Hold to talk
              </Button>
              <Button className="bg-slate-500" onClick={connectRealtime} disabled={!isOnline || tokenMutation.isPending}>
                Retry connection
              </Button>
              <Button className="bg-red-700" onClick={endSession}>
                End session
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
              {transcript.length === 0 && <p className="text-sm text-slate-500">Transcript appears here once the conversation starts.</p>}
              {transcript.map((turn) => (
                <div key={`${turn.id}-${turn.ts}`} className="rounded bg-slate-50 p-2 text-sm">
                  <span className="font-semibold capitalize">{turn.speaker}:</span> {turn.text}
                </div>
              ))}
            </div>
          </section>
        )}

        {step === "end" && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Interview complete</h2>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
              {transcript.map((turn) => (
                <div key={`${turn.id}-${turn.ts}`} className="rounded bg-slate-50 p-2 text-sm">
                  <span className="font-semibold capitalize">{turn.speaker}:</span> {turn.text}
                </div>
              ))}
              {transcript.length === 0 && <p className="text-sm text-slate-500">No transcript captured.</p>}
            </div>
            <Button
              onClick={() => {
                navigate("/widget/results");
              }}
            >
              Save and view results
            </Button>
            <Button className="bg-slate-500" onClick={resetFlow}>
              Start over
            </Button>
          </section>
        )}

        {!isOnline && <p className="mt-4 text-sm text-red-700">You are offline. Reconnect to continue.</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </Card>
    </main>
  );
};

const ChatFlow = ({ programId, onRestart }: { programId: string; onRestart: () => void }) => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingScoreRetry, setPendingScoreRetry] = useState(false);
  const isOnline = useOnlineStatus();

  const { transcript, sessionId, setSessionId, addTranscriptTurn, setMode, setProgramId, setScorecard, clear } = useWidgetStore();
  const transcriptRef = useRef<TranscriptTurnInput[]>([]);

  const questionsQuery = useQuery({
    queryKey: ["program-questions", programId, "chat"],
    queryFn: async () => {
      const response = await api.getProgramQuestions(programId, "chat");
      return response.data.orderedQuestions;
    }
  });

  const createSessionMutation = useMutation({ mutationFn: () => api.createSession("chat", { programId }) });
  const appendTranscriptMutation = useMutation({
    mutationFn: ({ id, turns }: { id: string; turns: TranscriptTurnInput[] }) => api.appendTranscript(id, turns)
  });
  const completeSessionMutation = useMutation({ mutationFn: (id: string) => api.completeSession(id) });
  const scoreSessionMutation = useMutation({
    mutationFn: () =>
      api.scoreSession({
        sessionId: sessionId!,
        mode: "chat",
        programId,
        transcriptTurns: transcriptRef.current
      })
  });

  const finalizeWithScoring = async () => {
    if (!sessionId) return;

    try {
      await completeSessionMutation.mutateAsync(sessionId);
      const score = await scoreSessionMutation.mutateAsync();
      setScorecard(score.data);
      setPendingScoreRetry(false);
      navigate("/widget/results");
    } catch (finalizeError) {
      setPendingScoreRetry(true);
      setError(finalizeError instanceof Error ? finalizeError.message : "Scoring failed. Please retry.");
    }
  };

  useEffect(() => {
    clear();
    setProgramId(programId);
    setMode("chat");
  }, [clear, programId, setMode, setProgramId]);

  const pushTurn = async (id: string, speaker: "candidate" | "assistant", text: string) => {
    const turn = { id, speaker, text, ts: new Date().toISOString() };
    addTranscriptTurn(turn);
    transcriptRef.current.push({ ts: turn.ts, speaker: turn.speaker, text: turn.text });

    const currentSessionId = useWidgetStore.getState().sessionId;
    if (currentSessionId) {
      await appendTranscriptMutation.mutateAsync({ id: currentSessionId, turns: [{ ts: turn.ts, speaker, text }] });
    }
  };

  const startInterview = async () => {
    const questions = questionsQuery.data ?? [];
    if (questions.length === 0) {
      setError("No chat questions are configured for this program.");
      return;
    }

    setError(null);

    try {
      const session = await createSessionMutation.mutateAsync();
      setSessionId(session.id);
      setStarted(true);
      setCurrentIndex(0);

      await pushTurn(transcriptId("assistant"), "assistant", questions[0].prompt);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not start chat interview.");
    }
  };

  const submitAnswer = async () => {
    const answer = input.trim();
    if (!answer) return;

    const questions = questionsQuery.data ?? [];
    const question = questions[currentIndex];
    if (!question) return;

    setInput("");

    try {
      await pushTurn(transcriptId("candidate"), "candidate", answer);

      const nextIndex = currentIndex + 1;
      if (nextIndex >= questions.length) {
        await finalizeWithScoring();
        return;
      }

      setCurrentIndex(nextIndex);
      await pushTurn(transcriptId("assistant"), "assistant", questions[nextIndex].prompt);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit answer.");
    }
  };

  const questions = questionsQuery.data ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Chat Interview</h2>
          {!started && (
            <>
              <p className="text-sm text-slate-600">You will answer short text questions based on this program's priority traits.</p>
              <div className="flex gap-2">
                <Button onClick={startInterview} disabled={!isOnline || questionsQuery.isLoading || createSessionMutation.isPending}>
                  Start chat
                </Button>
                <Button className="bg-slate-500" onClick={onRestart}>
                  Back
                </Button>
              </div>
            </>
          )}

          {started && (
            <>
              <p className="text-sm text-slate-700">
                Progress: {Math.min(currentIndex + 1, questions.length)} of {questions.length}
              </p>

              <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                {transcript.map((turn) => (
                  <div
                    key={`${turn.id}-${turn.ts}`}
                    className={`rounded p-2 text-sm ${turn.speaker === "candidate" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`}
                  >
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
                <Button onClick={submitAnswer} disabled={!isOnline || appendTranscriptMutation.isPending || scoreSessionMutation.isPending}>
                  Send
                </Button>
              </div>
              {pendingScoreRetry && (
                <Button className="bg-slate-500" onClick={() => void finalizeWithScoring()} disabled={!isOnline || scoreSessionMutation.isPending}>
                  Retry scoring
                </Button>
              )}
            </>
          )}

          {!isOnline && <p className="text-sm text-red-700">You are offline. Reconnect to continue.</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </section>
      </Card>
    </main>
  );
};

const QuizFlow = ({ programId, onRestart }: { programId: string; onRestart: () => void }) => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingScoreRetry, setPendingScoreRetry] = useState(false);
  const isOnline = useOnlineStatus();

  const { sessionId, setSessionId, addTranscriptTurn, setProgramId, setMode, setScorecard, clear } = useWidgetStore();
  const responsesRef = useRef<Array<{ questionId: string; answer: string }>>([]);
  const transcriptRef = useRef<TranscriptTurnInput[]>([]);

  const questionsQuery = useQuery({
    queryKey: ["program-questions", programId, "quiz"],
    queryFn: async () => {
      const response = await api.getProgramQuestions(programId, "quiz");
      return response.data.orderedQuestions;
    }
  });

  const createSessionMutation = useMutation({ mutationFn: () => api.createSession("quiz", { programId }) });
  const appendTranscriptMutation = useMutation({
    mutationFn: ({ id, turns }: { id: string; turns: TranscriptTurnInput[] }) => api.appendTranscript(id, turns)
  });
  const completeSessionMutation = useMutation({ mutationFn: (id: string) => api.completeSession(id) });
  const scoreSessionMutation = useMutation({
    mutationFn: () =>
      api.scoreSession({
        sessionId: sessionId!,
        mode: "quiz",
        programId,
        transcriptTurns: transcriptRef.current,
        responses: responsesRef.current
      })
  });

  const finalizeWithScoring = async () => {
    if (!sessionId) return;

    try {
      await completeSessionMutation.mutateAsync(sessionId);
      const score = await scoreSessionMutation.mutateAsync();
      setScorecard(score.data);
      setPendingScoreRetry(false);
      navigate("/widget/results");
    } catch (finalizeError) {
      setPendingScoreRetry(true);
      setError(finalizeError instanceof Error ? finalizeError.message : "Scoring failed. Please retry.");
    }
  };

  useEffect(() => {
    clear();
    setProgramId(programId);
    setMode("quiz");
  }, [clear, programId, setMode, setProgramId]);

  const pushTurn = async (speaker: "candidate" | "assistant", text: string) => {
    const turn = { id: transcriptId(speaker), speaker, text, ts: new Date().toISOString() };
    addTranscriptTurn(turn);
    transcriptRef.current.push({ ts: turn.ts, speaker: turn.speaker, text: turn.text });

    const currentSessionId = useWidgetStore.getState().sessionId;
    if (currentSessionId) {
      await appendTranscriptMutation.mutateAsync({ id: currentSessionId, turns: [{ ts: turn.ts, speaker, text }] });
    }
  };

  const startQuiz = async () => {
    const questions = questionsQuery.data ?? [];
    if (questions.length === 0) {
      setError("No quiz questions are configured for this program.");
      return;
    }

    setError(null);

    try {
      const session = await createSessionMutation.mutateAsync();
      setSessionId(session.id);
      setStarted(true);
      setCurrentIndex(0);
      responsesRef.current = [];
      transcriptRef.current = [];
      await pushTurn("assistant", questions[0].prompt);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start quiz.");
    }
  };

  const selectAnswer = async (question: ProgramQuestion, option: string) => {
    try {
      const cleanAnswer = sanitizeOptionLabel(option);
      responsesRef.current.push({ questionId: question.id, answer: cleanAnswer });
      await pushTurn("candidate", cleanAnswer);

      const questions = questionsQuery.data ?? [];
      const nextIndex = currentIndex + 1;

      if (nextIndex >= questions.length) {
        await finalizeWithScoring();
        return;
      }

      setCurrentIndex(nextIndex);
      await pushTurn("assistant", questions[nextIndex].prompt);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Could not submit quiz answer.");
    }
  };

  const questions = questionsQuery.data ?? [];
  const currentQuestion = questions[currentIndex];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Quiz</h2>
          {!started && (
            <>
              <p className="text-sm text-slate-600">Pick the option that best matches you for each question.</p>
              <div className="flex gap-2">
                <Button onClick={startQuiz} disabled={!isOnline || questionsQuery.isLoading || createSessionMutation.isPending}>
                  Start quiz
                </Button>
                <Button className="bg-slate-500" onClick={onRestart}>
                  Back
                </Button>
              </div>
            </>
          )}

          {started && currentQuestion && (
            <>
              <p className="text-sm text-slate-700">
                Progress: {currentIndex + 1} of {questions.length}
              </p>
              <h3 className="text-lg font-semibold text-slate-900">{currentQuestion.prompt}</h3>
              <div className="grid gap-2">
                {currentQuestion.options.map((option) => (
                  <button
                    key={`${currentQuestion.id}-${option}`}
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-left text-sm hover:border-slate-900"
                    onClick={() => void selectAnswer(currentQuestion, option)}
                    disabled={!isOnline || appendTranscriptMutation.isPending || scoreSessionMutation.isPending}
                  >
                    {sanitizeOptionLabel(option)}
                  </button>
                ))}
              </div>
            </>
          )}

          {pendingScoreRetry && (
            <Button className="bg-slate-500" onClick={() => void finalizeWithScoring()} disabled={!isOnline || scoreSessionMutation.isPending}>
              Retry scoring
            </Button>
          )}
          {!isOnline && <p className="text-sm text-red-700">You are offline. Reconnect to continue.</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </section>
      </Card>
    </main>
  );
};

const confidenceLabel = (value: number) => {
  if (value >= 0.75) return "High";
  if (value >= 0.5) return "Medium";
  return "Low";
};

const ResultsPage = () => {
  const navigate = useNavigate();
  const scorecard = useWidgetStore((state) => state.scorecard);
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

  const grouped = useMemo(() => {
    if (!scorecard) return [];

    return bucketOrder
      .map((bucket) => ({
        bucket,
        items: scorecard.perTrait.filter((item) => item.bucket === bucket)
      }))
      .filter((group) => group.items.length > 0);
  }, [scorecard]);

  const topTraits = useMemo(() => {
    if (!scorecard) return [];

    return [...scorecard.perTrait]
      .sort((a, b) => b.score0to5 * bucketWeight[b.bucket] - a.score0to5 * bucketWeight[a.bucket])
      .slice(0, 3);
  }, [scorecard]);

  const leadCapture = (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-900">Request Info / Talk to an advisor</p>
      {!leadSubmitted && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={preferredChannel}
            onChange={(event) => setPreferredChannel(event.target.value as "email" | "sms" | "phone")}
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="phone">Phone</option>
          </select>
          <Button onClick={submitLead} disabled={createLeadMutation.isPending}>
            {createLeadMutation.isPending ? "Submitting..." : "Request Info"}
          </Button>
          {leadValidationError && <p className="text-sm text-red-700">{leadValidationError}</p>}
          {createLeadMutation.error && <p className="text-sm text-red-700">Failed to submit lead.</p>}
        </div>
      )}
      {leadSubmitted && <p className="text-sm text-emerald-700">Thanks - we&apos;ll reach out soon.</p>}
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card>
        <h2 className="mb-3 text-2xl font-semibold">Results</h2>

        {!scorecard && (
          <>
            <p className="mb-4 text-sm text-slate-600">
              {mode === "voice" ? "Voice scoring is not enabled in this step." : "No scorecard is available for this session."}
            </p>
            {leadCapture}
            <Button onClick={() => navigate("/widget")}>Back to start</Button>
          </>
        )}

        {scorecard && (
          <section className="space-y-4">
            <p className="text-sm text-slate-700">Overall score: {scorecard.overallScore.toFixed(2)} / 5.00</p>

            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-900">Top contributing traits</p>
              <div className="space-y-1">
                {topTraits.map((trait) => (
                  <p key={trait.traitId} className="text-sm text-slate-700">
                    {trait.traitName}: {trait.score0to5.toFixed(2)} ({trait.bucket})
                  </p>
                ))}
              </div>
            </div>

            {grouped.map((group) => (
              <div key={group.bucket} className="rounded-md border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">{group.bucket.replaceAll("_", " ")}</p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item.traitId} className="rounded bg-slate-50 p-2 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">
                        {item.traitName}: {item.score0to5.toFixed(2)} / 5
                      </p>
                      <p>Confidence: {confidenceLabel(item.confidence)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {leadCapture}
            <Button className="bg-slate-500" onClick={() => navigate("/widget")}>
              Start over
            </Button>
          </section>
        )}
      </Card>
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

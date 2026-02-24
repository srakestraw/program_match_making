import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card } from "@pmm/ui";
import { createApiClient } from "@pmm/api-client";
import { RealtimeSession } from "@pmm/voice";
import { useWidgetStore } from "./store";
import "./styles.css";
const queryClient = new QueryClient();
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000" });
const bucketOrder = ["CRITICAL", "VERY_IMPORTANT", "IMPORTANT", "NICE_TO_HAVE"];
const bucketWeight = {
    CRITICAL: 1,
    VERY_IMPORTANT: 0.8,
    IMPORTANT: 0.6,
    NICE_TO_HAVE: 0.4
};
const modeOptions = [
    { id: "voice", label: "Voice", description: "Live voice interview" },
    { id: "chat", label: "Chat", description: "Text-based interview" },
    { id: "quiz", label: "Quiz", description: "Multiple choice assessment" }
];
const transcriptId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const toTurnInput = (turns) => turns.map((turn) => ({ ts: turn.ts, speaker: turn.speaker, text: turn.text }));
const parseModeParam = (value) => {
    if (value === "voice" || value === "chat" || value === "quiz") {
        return value;
    }
    return null;
};
const sanitizeOptionLabel = (option) => option.replace(/\s*\[[0-5](?:\.\d+)?\]\s*$/g, "").replace(/\s*\([0-5](?:\.\d+)?\)\s*$/g, "").trim();
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
    const [selectedMode, setSelectedMode] = useState(queryMode);
    const [selectedProgramId, setSelectedProgramId] = useState(queryProgramId ?? "");
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
    const selectedProgram = useMemo(() => programsQuery.data?.find((program) => program.id === selectedProgramId) ?? null, [programsQuery.data, selectedProgramId]);
    const canStart = Boolean(selectedMode && selectedProgramId);
    if (started && selectedMode && selectedProgramId) {
        if (selectedMode === "voice") {
            return _jsx(VoiceFlow, { programId: selectedProgramId, onRestart: () => setStarted(false) });
        }
        if (selectedMode === "chat") {
            return _jsx(ChatFlow, { programId: selectedProgramId, onRestart: () => setStarted(false) });
        }
        return _jsx(QuizFlow, { programId: selectedProgramId, onRestart: () => setStarted(false) });
    }
    return (_jsx("main", { className: "mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10", children: _jsx(Card, { children: _jsxs("section", { className: "space-y-4", children: [_jsx("h1", { className: "text-3xl font-bold", children: "Program Match Interview" }), _jsx("p", { className: "text-sm text-slate-600", children: "Select your interview mode and program to begin." }), !lockMode && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800", children: "Mode" }), _jsx("div", { className: "grid gap-2 sm:grid-cols-3", children: modeOptions.map((mode) => (_jsxs("button", { type: "button", className: `rounded-md border p-3 text-left ${selectedMode === mode.id ? "border-slate-900 bg-slate-100" : "border-slate-200"}`, onClick: () => setSelectedMode(mode.id), children: [_jsx("p", { className: "text-sm font-semibold text-slate-900", children: mode.label }), _jsx("p", { className: "text-xs text-slate-600", children: mode.description })] }, mode.id))) })] })), lockMode && selectedMode && (_jsxs("p", { className: "rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700", children: ["Mode locked to: ", selectedMode.toUpperCase()] })), !queryProgramId && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-semibold text-slate-800", htmlFor: "program-select", children: "Program" }), _jsxs("select", { id: "program-select", className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm", value: selectedProgramId, onChange: (event) => setSelectedProgramId(event.target.value), disabled: programsQuery.isLoading, children: [_jsx("option", { value: "", children: "Select a program" }), (programsQuery.data ?? []).map((program) => (_jsx("option", { value: program.id, children: program.name }, program.id)))] })] })), queryProgramId && (_jsxs("p", { className: "rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700", children: ["Program locked to: ", selectedProgram?.name ?? queryProgramId] })), _jsx(Button, { disabled: !canStart, onClick: () => {
                            clear();
                            setMode(selectedMode);
                            setProgramId(selectedProgramId);
                            setStarted(true);
                        }, children: "Start" }), programsQuery.error && _jsx("p", { className: "text-sm text-red-700", children: "Failed to load programs." })] }) }) }));
};
const VoiceFlow = ({ programId, onRestart }) => {
    const navigate = useNavigate();
    const [step, setStep] = useState("start");
    const [error, setError] = useState(null);
    const [connectionState, setConnectionState] = useState("idle");
    const [micReady, setMicReady] = useState(false);
    const [deviceLabel, setDeviceLabel] = useState("Unknown microphone");
    const realtimeSessionRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const stepRef = useRef("start");
    const isOnline = useOnlineStatus();
    const { sessionId, transcript, setSessionId, addTranscriptTurn, setProgramId, setMode, setScorecard, clear } = useWidgetStore();
    const createSessionMutation = useMutation({ mutationFn: () => api.createSession("voice", { programId }) });
    const tokenMutation = useMutation({ mutationFn: api.getRealtimeToken });
    const appendTranscriptMutation = useMutation({
        mutationFn: ({ id, turns }) => api.appendTranscript(id, turns)
    });
    const completeSessionMutation = useMutation({ mutationFn: (id) => api.completeSession(id) });
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
        }
        catch {
            setError("Microphone access denied. Please allow mic permissions and retry.");
            setStep("permissions");
        }
    };
    const onTranscriptTurn = (turn) => {
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
        }
        catch (connectError) {
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
        }
        catch {
            setError("Session ended with errors. Transcript was kept locally.");
        }
        finally {
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
        if (connectionState === "connected")
            return "Connected";
        if (connectionState === "connecting")
            return "Connecting";
        if (connectionState === "disconnected")
            return "Disconnected";
        if (connectionState === "error")
            return "Error";
        return "Idle";
    }, [connectionState]);
    return (_jsx("main", { className: "mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10", children: _jsxs(Card, { children: [step === "start" && (_jsxs("section", { className: "space-y-4", children: [_jsx("h1", { className: "text-3xl font-bold", children: "Voice Interview" }), _jsx("p", { className: "text-sm text-slate-600", children: "We only capture your interview audio and transcript for evaluation. Click start when you are ready." }), _jsx(Button, { onClick: startPermissionCheck, children: "Start voice interview" })] })), step === "permissions" && (_jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Mic and device check" }), _jsxs("p", { className: "text-sm text-slate-700", children: ["Device: ", deviceLabel] }), _jsxs("p", { className: "text-sm text-slate-700", children: ["Permission: ", micReady ? "Granted" : "Not granted"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: connectRealtime, disabled: !isOnline || !micReady || createSessionMutation.isPending || tokenMutation.isPending, children: "Continue to interview" }), _jsx(Button, { className: "bg-slate-500", onClick: startPermissionCheck, children: "Retry device check" })] })] })), step === "session" && (_jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "In-session voice" }), _jsxs("p", { className: "text-sm text-slate-700", children: ["Connection status: ", statusLabel] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onMouseDown: () => realtimeSessionRef.current?.setPushToTalk(true), onMouseUp: () => realtimeSessionRef.current?.setPushToTalk(false), onMouseLeave: () => realtimeSessionRef.current?.setPushToTalk(false), onTouchStart: () => realtimeSessionRef.current?.setPushToTalk(true), onTouchEnd: () => realtimeSessionRef.current?.setPushToTalk(false), disabled: !isOnline || connectionState !== "connected", children: "Hold to talk" }), _jsx(Button, { className: "bg-slate-500", onClick: connectRealtime, disabled: !isOnline || tokenMutation.isPending, children: "Retry connection" }), _jsx(Button, { className: "bg-red-700", onClick: endSession, children: "End session" })] }), _jsxs("div", { className: "max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3", children: [transcript.length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "Transcript appears here once the conversation starts." }), transcript.map((turn) => (_jsxs("div", { className: "rounded bg-slate-50 p-2 text-sm", children: [_jsxs("span", { className: "font-semibold capitalize", children: [turn.speaker, ":"] }), " ", turn.text] }, `${turn.id}-${turn.ts}`)))] })] })), step === "end" && (_jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Interview complete" }), _jsxs("div", { className: "max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3", children: [transcript.map((turn) => (_jsxs("div", { className: "rounded bg-slate-50 p-2 text-sm", children: [_jsxs("span", { className: "font-semibold capitalize", children: [turn.speaker, ":"] }), " ", turn.text] }, `${turn.id}-${turn.ts}`))), transcript.length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "No transcript captured." })] }), _jsx(Button, { onClick: () => {
                                navigate("/widget/results");
                            }, children: "Save and view results" }), _jsx(Button, { className: "bg-slate-500", onClick: resetFlow, children: "Start over" })] })), !isOnline && _jsx("p", { className: "mt-4 text-sm text-red-700", children: "You are offline. Reconnect to continue." }), error && _jsx("p", { className: "mt-4 text-sm text-red-700", children: error })] }) }));
};
const ChatFlow = ({ programId, onRestart }) => {
    const navigate = useNavigate();
    const [input, setInput] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [started, setStarted] = useState(false);
    const [error, setError] = useState(null);
    const [pendingScoreRetry, setPendingScoreRetry] = useState(false);
    const isOnline = useOnlineStatus();
    const { transcript, sessionId, setSessionId, addTranscriptTurn, setMode, setProgramId, setScorecard, clear } = useWidgetStore();
    const transcriptRef = useRef([]);
    const questionsQuery = useQuery({
        queryKey: ["program-questions", programId, "chat"],
        queryFn: async () => {
            const response = await api.getProgramQuestions(programId, "chat");
            return response.data.orderedQuestions;
        }
    });
    const createSessionMutation = useMutation({ mutationFn: () => api.createSession("chat", { programId }) });
    const appendTranscriptMutation = useMutation({
        mutationFn: ({ id, turns }) => api.appendTranscript(id, turns)
    });
    const completeSessionMutation = useMutation({ mutationFn: (id) => api.completeSession(id) });
    const scoreSessionMutation = useMutation({
        mutationFn: () => api.scoreSession({
            sessionId: sessionId,
            mode: "chat",
            programId,
            transcriptTurns: transcriptRef.current
        })
    });
    const finalizeWithScoring = async () => {
        if (!sessionId)
            return;
        try {
            await completeSessionMutation.mutateAsync(sessionId);
            const score = await scoreSessionMutation.mutateAsync();
            setScorecard(score.data);
            setPendingScoreRetry(false);
            navigate("/widget/results");
        }
        catch (finalizeError) {
            setPendingScoreRetry(true);
            setError(finalizeError instanceof Error ? finalizeError.message : "Scoring failed. Please retry.");
        }
    };
    useEffect(() => {
        clear();
        setProgramId(programId);
        setMode("chat");
    }, [clear, programId, setMode, setProgramId]);
    const pushTurn = async (id, speaker, text) => {
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
        }
        catch (sessionError) {
            setError(sessionError instanceof Error ? sessionError.message : "Could not start chat interview.");
        }
    };
    const submitAnswer = async () => {
        const answer = input.trim();
        if (!answer)
            return;
        const questions = questionsQuery.data ?? [];
        const question = questions[currentIndex];
        if (!question)
            return;
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
        }
        catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Could not submit answer.");
        }
    };
    const questions = questionsQuery.data ?? [];
    return (_jsx("main", { className: "mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10", children: _jsx(Card, { children: _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Chat Interview" }), !started && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm text-slate-600", children: "You will answer short text questions based on this program's priority traits." }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: startInterview, disabled: !isOnline || questionsQuery.isLoading || createSessionMutation.isPending, children: "Start chat" }), _jsx(Button, { className: "bg-slate-500", onClick: onRestart, children: "Back" })] })] })), started && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm text-slate-700", children: ["Progress: ", Math.min(currentIndex + 1, questions.length), " of ", questions.length] }), _jsx("div", { className: "max-h-80 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3", children: transcript.map((turn) => (_jsxs("div", { className: `rounded p-2 text-sm ${turn.speaker === "candidate" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`, children: [_jsxs("span", { className: "font-semibold capitalize", children: [turn.speaker, ":"] }), " ", turn.text] }, `${turn.id}-${turn.ts}`))) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm", value: input, onChange: (event) => setInput(event.target.value), onKeyDown: (event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                void submitAnswer();
                                            }
                                        }, placeholder: "Type your answer" }), _jsx(Button, { onClick: submitAnswer, disabled: !isOnline || appendTranscriptMutation.isPending || scoreSessionMutation.isPending, children: "Send" })] }), pendingScoreRetry && (_jsx(Button, { className: "bg-slate-500", onClick: () => void finalizeWithScoring(), disabled: !isOnline || scoreSessionMutation.isPending, children: "Retry scoring" }))] })), !isOnline && _jsx("p", { className: "text-sm text-red-700", children: "You are offline. Reconnect to continue." }), error && _jsx("p", { className: "text-sm text-red-700", children: error })] }) }) }));
};
const QuizFlow = ({ programId, onRestart }) => {
    const navigate = useNavigate();
    const [started, setStarted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [error, setError] = useState(null);
    const [pendingScoreRetry, setPendingScoreRetry] = useState(false);
    const isOnline = useOnlineStatus();
    const { sessionId, setSessionId, addTranscriptTurn, setProgramId, setMode, setScorecard, clear } = useWidgetStore();
    const responsesRef = useRef([]);
    const transcriptRef = useRef([]);
    const questionsQuery = useQuery({
        queryKey: ["program-questions", programId, "quiz"],
        queryFn: async () => {
            const response = await api.getProgramQuestions(programId, "quiz");
            return response.data.orderedQuestions;
        }
    });
    const createSessionMutation = useMutation({ mutationFn: () => api.createSession("quiz", { programId }) });
    const appendTranscriptMutation = useMutation({
        mutationFn: ({ id, turns }) => api.appendTranscript(id, turns)
    });
    const completeSessionMutation = useMutation({ mutationFn: (id) => api.completeSession(id) });
    const scoreSessionMutation = useMutation({
        mutationFn: () => api.scoreSession({
            sessionId: sessionId,
            mode: "quiz",
            programId,
            transcriptTurns: transcriptRef.current,
            responses: responsesRef.current
        })
    });
    const finalizeWithScoring = async () => {
        if (!sessionId)
            return;
        try {
            await completeSessionMutation.mutateAsync(sessionId);
            const score = await scoreSessionMutation.mutateAsync();
            setScorecard(score.data);
            setPendingScoreRetry(false);
            navigate("/widget/results");
        }
        catch (finalizeError) {
            setPendingScoreRetry(true);
            setError(finalizeError instanceof Error ? finalizeError.message : "Scoring failed. Please retry.");
        }
    };
    useEffect(() => {
        clear();
        setProgramId(programId);
        setMode("quiz");
    }, [clear, programId, setMode, setProgramId]);
    const pushTurn = async (speaker, text) => {
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
        }
        catch (startError) {
            setError(startError instanceof Error ? startError.message : "Could not start quiz.");
        }
    };
    const selectAnswer = async (question, option) => {
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
        }
        catch (selectError) {
            setError(selectError instanceof Error ? selectError.message : "Could not submit quiz answer.");
        }
    };
    const questions = questionsQuery.data ?? [];
    const currentQuestion = questions[currentIndex];
    return (_jsx("main", { className: "mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10", children: _jsx(Card, { children: _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Quiz" }), !started && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm text-slate-600", children: "Pick the option that best matches you for each question." }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: startQuiz, disabled: !isOnline || questionsQuery.isLoading || createSessionMutation.isPending, children: "Start quiz" }), _jsx(Button, { className: "bg-slate-500", onClick: onRestart, children: "Back" })] })] })), started && currentQuestion && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm text-slate-700", children: ["Progress: ", currentIndex + 1, " of ", questions.length] }), _jsx("h3", { className: "text-lg font-semibold text-slate-900", children: currentQuestion.prompt }), _jsx("div", { className: "grid gap-2", children: currentQuestion.options.map((option) => (_jsx("button", { type: "button", className: "rounded-md border border-slate-300 bg-white px-4 py-2 text-left text-sm hover:border-slate-900", onClick: () => void selectAnswer(currentQuestion, option), disabled: !isOnline || appendTranscriptMutation.isPending || scoreSessionMutation.isPending, children: sanitizeOptionLabel(option) }, `${currentQuestion.id}-${option}`))) })] })), pendingScoreRetry && (_jsx(Button, { className: "bg-slate-500", onClick: () => void finalizeWithScoring(), disabled: !isOnline || scoreSessionMutation.isPending, children: "Retry scoring" })), !isOnline && _jsx("p", { className: "text-sm text-red-700", children: "You are offline. Reconnect to continue." }), error && _jsx("p", { className: "text-sm text-red-700", children: error })] }) }) }));
};
const confidenceLabel = (value) => {
    if (value >= 0.75)
        return "High";
    if (value >= 0.5)
        return "Medium";
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
    const [preferredChannel, setPreferredChannel] = useState("email");
    const [leadSubmitted, setLeadSubmitted] = useState(false);
    const [leadValidationError, setLeadValidationError] = useState(null);
    const isOnline = useOnlineStatus();
    const createLeadMutation = useMutation({
        mutationFn: () => api.createPublicLead({
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
        if (!scorecard)
            return [];
        return bucketOrder
            .map((bucket) => ({
            bucket,
            items: scorecard.perTrait.filter((item) => item.bucket === bucket)
        }))
            .filter((group) => group.items.length > 0);
    }, [scorecard]);
    const topTraits = useMemo(() => {
        if (!scorecard)
            return [];
        return [...scorecard.perTrait]
            .sort((a, b) => b.score0to5 * bucketWeight[b.bucket] - a.score0to5 * bucketWeight[a.bucket])
            .slice(0, 3);
    }, [scorecard]);
    const leadCapture = (_jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsx("p", { className: "mb-2 text-sm font-semibold text-slate-900", children: "Request Info / Talk to an advisor" }), !leadSubmitted && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "First name", value: firstName, onChange: (event) => setFirstName(event.target.value) }), _jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Last name", value: lastName, onChange: (event) => setLastName(event.target.value) })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Email", type: "email", value: email, onChange: (event) => setEmail(event.target.value) }), _jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Phone (optional)", value: phone, onChange: (event) => setPhone(event.target.value) })] }), _jsxs("select", { className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm", value: preferredChannel, onChange: (event) => setPreferredChannel(event.target.value), children: [_jsx("option", { value: "email", children: "Email" }), _jsx("option", { value: "sms", children: "SMS" }), _jsx("option", { value: "phone", children: "Phone" })] }), _jsx(Button, { onClick: submitLead, disabled: createLeadMutation.isPending, children: createLeadMutation.isPending ? "Submitting..." : "Request Info" }), leadValidationError && _jsx("p", { className: "text-sm text-red-700", children: leadValidationError }), createLeadMutation.error && _jsx("p", { className: "text-sm text-red-700", children: "Failed to submit lead." })] })), leadSubmitted && _jsx("p", { className: "text-sm text-emerald-700", children: "Thanks - we'll reach out soon." })] }));
    return (_jsx("main", { className: "mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10", children: _jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-2xl font-semibold", children: "Results" }), !scorecard && (_jsxs(_Fragment, { children: [_jsx("p", { className: "mb-4 text-sm text-slate-600", children: mode === "voice" ? "Voice scoring is not enabled in this step." : "No scorecard is available for this session." }), leadCapture, _jsx(Button, { onClick: () => navigate("/widget"), children: "Back to start" })] })), scorecard && (_jsxs("section", { className: "space-y-4", children: [_jsxs("p", { className: "text-sm text-slate-700", children: ["Overall score: ", scorecard.overallScore.toFixed(2), " / 5.00"] }), _jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsx("p", { className: "mb-2 text-sm font-semibold text-slate-900", children: "Top contributing traits" }), _jsx("div", { className: "space-y-1", children: topTraits.map((trait) => (_jsxs("p", { className: "text-sm text-slate-700", children: [trait.traitName, ": ", trait.score0to5.toFixed(2), " (", trait.bucket, ")"] }, trait.traitId))) })] }), grouped.map((group) => (_jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsx("p", { className: "mb-2 text-sm font-semibold text-slate-900", children: group.bucket.replaceAll("_", " ") }), _jsx("div", { className: "space-y-2", children: group.items.map((item) => (_jsxs("div", { className: "rounded bg-slate-50 p-2 text-sm text-slate-700", children: [_jsxs("p", { className: "font-semibold text-slate-900", children: [item.traitName, ": ", item.score0to5.toFixed(2), " / 5"] }), _jsxs("p", { children: ["Confidence: ", confidenceLabel(item.confidence)] })] }, item.traitId))) })] }, group.bucket))), leadCapture, _jsx(Button, { className: "bg-slate-500", onClick: () => navigate("/widget"), children: "Start over" })] }))] }) }));
};
const App = () => (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/widget", replace: true }) }), _jsx(Route, { path: "/widget", element: _jsx(WidgetSetup, {}) }), _jsx(Route, { path: "/widget/results", element: _jsx(ResultsPage, {}) })] }) }));
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(App, {}) }) }));

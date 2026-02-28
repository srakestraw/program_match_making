import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Button, Card } from "@pmm/ui";
import { createApiClient } from "@pmm/api-client";
import { RealtimeSession } from "@pmm/voice";
import { ProgramFloatField } from "./components/ProgramFloatField";
import { TraitScorePanel } from "./components/TraitScorePanel";
import { VoiceBlob } from "./components/VoiceBlob";
import { useWidgetStore } from "./store";
import { getVoicePhaseLabel, isConnectedPhase, reduceVoicePhase, shouldKickoff, toVoiceBlobState } from "./lib/voiceState";
import { createLanguageUtterance } from "./lib/browserTts";
import { EXTRA_LANGUAGE_OPTIONS, PRIMARY_LANGUAGE_OPTIONS } from "./constants/languages";
import { LanguagePills } from "./components/LanguagePills";
import { LanguagePickerModal } from "./components/LanguagePickerModal";
import "./styles.css";
const queryClient = new QueryClient();
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000" });
const modeOptions = [
    { id: "voice", label: "Voice", description: "Live conversational interview" },
    { id: "chat", label: "Chat", description: "Trait-driven text interview" },
    { id: "quiz", label: "Quiz", description: "Structured trait questions" }
];
const parseModeParam = (value) => {
    if (value === "voice" || value === "chat" || value === "quiz")
        return value;
    return null;
};
const transcriptId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
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
const LiveInsightsSidebar = ({ snapshot, programFit, activeTraitId, done = false }) => (_jsxs("aside", { className: "space-y-3", children: [_jsx(TraitScorePanel, { traits: snapshot?.traits ?? [], activeTraitId: activeTraitId ?? null, done: done }), _jsx(ProgramFloatField, { programs: programFit?.programs ?? [], selectedProgramId: programFit?.selectedProgramId ?? null, done: done })] }));
const WidgetSetup = () => {
    const [searchParams] = useSearchParams();
    const queryMode = parseModeParam(searchParams.get("mode"));
    const lockMode = queryMode !== null || ["1", "true", "yes"].includes((searchParams.get("lockMode") ?? "").toLowerCase());
    const queryProgramId = searchParams.get("programId");
    const programFilterIds = queryProgramId ? [queryProgramId] : [];
    const [selectedMode, setSelectedMode] = useState(queryMode);
    const [started, setStarted] = useState(false);
    const clear = useWidgetStore((state) => state.clear);
    const setMode = useWidgetStore((state) => state.setMode);
    const setProgramId = useWidgetStore((state) => state.setProgramId);
    const setProgramFilterIds = useWidgetStore((state) => state.setProgramFilterIds);
    useEffect(() => {
        if (queryMode)
            setSelectedMode(queryMode);
    }, [queryMode]);
    const canStart = Boolean(selectedMode);
    if (started && selectedMode) {
        if (selectedMode === "voice") {
            return _jsx(VoiceFlow, { mode: selectedMode, programFilterIds: programFilterIds, onRestart: () => setStarted(false) });
        }
        if (selectedMode === "chat") {
            return _jsx(ChatFlow, { mode: selectedMode, programFilterIds: programFilterIds, onRestart: () => setStarted(false) });
        }
        return _jsx(QuizFlow, { mode: selectedMode, programFilterIds: programFilterIds, onRestart: () => setStarted(false) });
    }
    return (_jsx("main", { className: "mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10", children: _jsx(Card, { children: _jsxs("section", { className: "space-y-4", children: [_jsx("h1", { className: "text-3xl font-bold", children: "Program Match Interview" }), _jsx("p", { className: "text-sm text-slate-600", children: "Choose interview type to begin. Program ranking starts after your first responses." }), !lockMode && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800", children: "Interview type" }), _jsx("div", { className: "grid gap-2 sm:grid-cols-3", children: modeOptions.map((mode) => (_jsxs("button", { type: "button", className: `rounded-md border p-3 text-left ${selectedMode === mode.id ? "border-slate-900 bg-slate-100" : "border-slate-200"}`, onClick: () => setSelectedMode(mode.id), children: [_jsx("p", { className: "text-sm font-semibold text-slate-900", children: mode.label }), _jsx("p", { className: "text-xs text-slate-600", children: mode.description })] }, mode.id))) })] })), lockMode && selectedMode && (_jsxs("p", { className: "rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700", children: ["Mode locked to: ", selectedMode.toUpperCase()] })), programFilterIds.length > 0 && (_jsx("p", { className: "rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700", children: "Program filter from URL is active (1 program)." })), _jsx(Button, { disabled: !canStart, onClick: () => {
                            clear();
                            setMode(selectedMode);
                            setProgramFilterIds(programFilterIds);
                            setProgramId(programFilterIds[0] ?? null);
                            setStarted(true);
                        }, children: "Start" })] }) }) }));
};
const VoiceFlow = ({ mode, programFilterIds, onRestart }) => {
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [transportState, setTransportState] = useState("idle");
    const [deviceLabel, setDeviceLabel] = useState("Unknown microphone");
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [askedTraitIds, setAskedTraitIds] = useState([]);
    const [askedQuestionIds, setAskedQuestionIds] = useState([]);
    const [checkpointOpen, setCheckpointOpen] = useState(false);
    const [connectStalled, setConnectStalled] = useState(false);
    const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
    const realtimeSessionRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const sessionIdRef = useRef(null);
    const lastCandidateTurnIdRef = useRef(null);
    const kickoffStartedRef = useRef(false);
    const speechSynthesisRef = useRef(null);
    const isOnline = useOnlineStatus();
    const { transcript, scoringSnapshot, programFit, checkpoint, voicePhase, voiceInputMode, sessionLanguageTag, sessionLanguageLabel, detectedLanguageSuggestion, setSessionId, addTranscriptTurn, setMode, setProgramFilterIds, setScoringSnapshot, setProgramFit, setAnsweredTraitCount, setCheckpoint, setVoicePhase, setVoiceInputMode, setSessionLanguage, setDetectedLanguage, dismissDetectedLanguage, clear } = useWidgetStore();
    const debugVoice = (message, details) => {
        if (typeof window === "undefined")
            return;
        if (window.localStorage.getItem("DEBUG_VOICE") !== "1")
            return;
        console.info("[voice]", message, details ?? {});
    };
    const transitionPhase = (event) => {
        const next = reduceVoicePhase(useWidgetStore.getState().voicePhase, event);
        debugVoice("phase", { from: useWidgetStore.getState().voicePhase, to: next, event });
        setVoicePhase(next);
    };
    const setMicListeningState = (enabled) => {
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
        if (!checkpoint?.required)
            return;
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
        if (!realtimeSessionRef.current)
            return;
        if (!isConnectedPhase(voicePhase))
            return;
        realtimeSessionRef.current.updateInstructions(`You are a warm admissions interviewer. Respond in ${sessionLanguageLabel} only. Do not switch languages unless the user explicitly asks.`);
    }, [sessionLanguageTag, sessionLanguageLabel, voicePhase]);
    const tokenMutation = useMutation({
        mutationFn: (input) => api.getRealtimeToken(input)
    });
    const appendTranscriptMutation = useMutation({
        mutationFn: ({ id, turns }) => api.appendTranscript(id, turns)
    });
    const createInterviewMutation = useMutation({
        mutationFn: () => api.createInterviewSession({
            mode,
            language: sessionLanguageTag,
            programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
        })
    });
    const turnMutation = useMutation({
        mutationFn: (text) => api.submitInterviewTurn(sessionIdRef.current, {
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
        mutationFn: (action) => api.submitInterviewCheckpoint(sessionIdRef.current, {
            mode,
            action,
            focusTraitIds: action === "focus" ? checkpoint?.suggestedTraitIds : undefined,
            askedTraitIds,
            askedQuestionIds,
            programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
        })
    });
    const speakPrompt = (text) => {
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
    const pushAssistantQuestion = async (question, prefix) => {
        if (!question)
            return;
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
    const kickoffIfNeeded = async (interview) => {
        if (!shouldKickoff(useWidgetStore.getState().voicePhase, kickoffStartedRef.current))
            return;
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
    const onTranscriptTurn = async (turn) => {
        if (turn.speaker !== "candidate") {
            return;
        }
        if (voicePhase !== "listening")
            return;
        if (lastCandidateTurnIdRef.current === turn.id)
            return;
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
            }
            else {
                setVoicePhase("ended");
            }
        }
        catch (turnError) {
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
            if (!id)
                throw new Error("Session id missing");
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
            realtimeSession.updateInstructions(interview.systemPrompt ??
                `You are a warm admissions interviewer. Respond in ${sessionLanguageLabel} only. Do not switch languages unless the user explicitly asks.`);
            transitionPhase("transport_connected");
            await kickoffIfNeeded(interview);
        }
        catch (startError) {
            setError(startError instanceof Error ? startError.message : "Failed to start voice interview.");
            setVoicePhase("error");
        }
    };
    const handleCheckpointAction = async (action) => {
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
            }
            else {
                transitionPhase("resume");
            }
        }
        catch (checkpointError) {
            setError(checkpointError instanceof Error ? checkpointError.message : "Checkpoint action failed.");
            setVoicePhase("error");
        }
    };
    const endSession = async () => {
        try {
            window.speechSynthesis?.cancel();
            await realtimeSessionRef.current?.disconnect();
            if (sessionIdRef.current)
                await api.completeSession(sessionIdRef.current);
        }
        catch {
            setError("Session ended with errors. Transcript kept locally.");
        }
        finally {
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
        if (isConnectedPhase(voicePhase))
            return "Connected";
        if (transportState === "connecting" || voicePhase === "connecting")
            return "Connecting";
        if (transportState === "error" || voicePhase === "error")
            return "Error";
        if (transportState === "disconnected")
            return "Disconnected";
        return "Not connected";
    }, [transportState, voicePhase]);
    const canStart = voicePhase === "init" || voicePhase === "permissions" || voicePhase === "error";
    const activeSession = !["init", "permissions", "connecting", "error", "ended"].includes(voicePhase);
    return (_jsx("main", { className: "mx-auto min-h-screen max-w-7xl px-4 py-8", children: _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]", children: [_jsxs(Card, { children: [_jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Adaptive voice interview" }), _jsx(VoiceBlob, { state: toVoiceBlobState(voicePhase) }), _jsxs("p", { className: "text-sm text-slate-700", children: ["State: ", _jsx("span", { className: "font-semibold", children: getVoicePhaseLabel(voicePhase) }), " | Connection: ", connectionLabel] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm text-slate-700", children: "Language" }), _jsx(LanguagePills, { valueTag: sessionLanguageTag, options: PRIMARY_LANGUAGE_OPTIONS, customLanguage: PRIMARY_LANGUAGE_OPTIONS.some((option) => option.tag.toLowerCase() === sessionLanguageTag.toLowerCase())
                                                ? null
                                                : { tag: sessionLanguageTag, label: sessionLanguageLabel }, onChangeTag: (tag, label) => setSessionLanguage(tag, label), onOpenOther: () => setLanguagePickerOpen(true) })] }), detectedLanguageSuggestion && !detectedLanguageSuggestion.dismissed && (_jsxs("div", { className: "rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900", children: ["We detected ", detectedLanguageSuggestion.label, ". Switch?", _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx(Button, { className: "bg-slate-700", onClick: () => setSessionLanguage(detectedLanguageSuggestion.tag, detectedLanguageSuggestion.label), children: "Switch" }), _jsxs(Button, { className: "bg-slate-500", onClick: dismissDetectedLanguage, children: ["Keep ", sessionLanguageLabel] })] })] })), _jsxs("p", { className: "text-sm text-slate-700", children: ["Input mode: ", voiceInputMode === "handsfree" ? "Hands-free" : "Hold-to-talk", " | Device: ", deviceLabel] }), canStart && (_jsx(Button, { onClick: startInterview, disabled: !isOnline || createInterviewMutation.isPending || tokenMutation.isPending, children: "Start interview" })), connectStalled && (_jsxs("div", { className: "rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900", children: ["Connection is taking longer than expected.", _jsx("div", { className: "mt-2", children: _jsx(Button, { className: "bg-slate-600", onClick: startInterview, children: "Retry connect" }) })] })), currentQuestion && (_jsxs("p", { className: "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700", children: ["Current trait: ", _jsx("span", { className: "font-semibold", children: currentQuestion.traitName })] })), activeSession && (_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { className: "bg-slate-500", onClick: () => setVoicePhase(voicePhase === "paused" ? "listening" : "paused"), children: voicePhase === "paused" ? "Resume" : "Pause" }), _jsx(Button, { className: "bg-slate-500", onClick: () => setVoiceInputMode(voiceInputMode === "handsfree" ? "hold_to_talk" : "handsfree"), children: voiceInputMode === "handsfree" ? "Use hold-to-talk" : "Use hands-free" }), voiceInputMode === "hold_to_talk" && (_jsx(Button, { onMouseDown: () => {
                                                if (voicePhase !== "paused")
                                                    setVoicePhase("listening");
                                                realtimeSessionRef.current?.setPushToTalk(true);
                                            }, onMouseUp: () => realtimeSessionRef.current?.setPushToTalk(false), onMouseLeave: () => realtimeSessionRef.current?.setPushToTalk(false), onTouchStart: () => {
                                                if (voicePhase !== "paused")
                                                    setVoicePhase("listening");
                                                realtimeSessionRef.current?.setPushToTalk(true);
                                            }, onTouchEnd: () => realtimeSessionRef.current?.setPushToTalk(false), disabled: voicePhase === "paused", children: "Hold to talk" })), _jsx(Button, { className: "bg-red-700", onClick: endSession, children: "End" })] })), _jsxs("div", { className: "max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3", children: [transcript.length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "Transcript appears as the conversation runs." }), transcript.map((turn) => (_jsxs("div", { className: "rounded bg-slate-50 p-2 text-sm", children: [_jsxs("span", { className: "font-semibold capitalize", children: [turn.speaker, ":"] }), " ", turn.text] }, `${turn.id}-${turn.ts}`)))] }), checkpointOpen && checkpoint && (_jsxs("div", { className: "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm", children: [_jsx("p", { className: "font-semibold text-slate-900", children: checkpoint.prompt }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [_jsx(Button, { className: "bg-slate-700", onClick: () => void handleCheckpointAction("stop"), children: "Stop and review" }), _jsx(Button, { onClick: () => void handleCheckpointAction("continue"), children: "Keep going" }), _jsx(Button, { className: "bg-slate-500", onClick: () => void handleCheckpointAction("focus"), disabled: checkpoint.suggestedTraitIds.length === 0, children: "Focus trait area" })] })] })), voicePhase === "ended" && (_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: () => navigate("/widget/results"), children: "Review results" }), _jsx(Button, { className: "bg-slate-500", onClick: resetFlow, children: "Start over" })] })), !isOnline && _jsx("p", { className: "text-sm text-red-700", children: "You are offline. Reconnect to continue." }), error && _jsx("p", { className: "text-sm text-red-700", children: error })] }), _jsx(LanguagePickerModal, { open: languagePickerOpen, options: EXTRA_LANGUAGE_OPTIONS, onClose: () => setLanguagePickerOpen(false), onSelect: (tag, label) => {
                                setSessionLanguage(tag, label);
                                setLanguagePickerOpen(false);
                            } })] }), _jsx(LiveInsightsSidebar, { snapshot: scoringSnapshot, programFit: programFit, activeTraitId: currentQuestion?.traitId ?? null, done: voicePhase === "ended" })] }) }));
};
const ChatFlow = ({ mode, programFilterIds, onRestart }) => {
    const navigate = useNavigate();
    const [input, setInput] = useState("");
    const [started, setStarted] = useState(false);
    const [error, setError] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [askedTraitIds, setAskedTraitIds] = useState([]);
    const [askedQuestionIds, setAskedQuestionIds] = useState([]);
    const isOnline = useOnlineStatus();
    const { transcript, sessionId, scoringSnapshot, programFit, sessionLanguageTag, setSessionId, addTranscriptTurn, setMode, setProgramFilterIds, setScoringSnapshot, setProgramFit, clear } = useWidgetStore();
    const createInterviewMutation = useMutation({
        mutationFn: () => api.createInterviewSession({
            mode,
            language: sessionLanguageTag,
            programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
        })
    });
    const turnMutation = useMutation({
        mutationFn: (text) => api.submitInterviewTurn(sessionId, {
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
            if (!id)
                throw new Error("Session id missing");
            setSessionId(id);
            setScoringSnapshot(session.scoring_snapshot ?? null);
            setProgramFit(session.program_fit ?? null);
            setStarted(true);
            setCurrentQuestion(session.nextQuestion ?? null);
            if (session.nextQuestion) {
                addTranscriptTurn({ id: transcriptId("assistant"), speaker: "assistant", text: session.nextQuestion.prompt, ts: new Date().toISOString() });
            }
        }
        catch (sessionError) {
            setError(sessionError instanceof Error ? sessionError.message : "Could not start chat interview.");
        }
    };
    const submitAnswer = async () => {
        const answer = input.trim();
        if (!answer || !currentQuestion)
            return;
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
            }
            else {
                await api.completeSession(sessionId);
                navigate("/widget/results");
            }
        }
        catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Could not submit answer.");
        }
    };
    return (_jsx("main", { className: "mx-auto min-h-screen max-w-7xl px-4 py-8", children: _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]", children: [_jsx(Card, { children: _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Chat Interview" }), !started && (_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: startInterview, disabled: !isOnline || createInterviewMutation.isPending, children: "Start chat" }), _jsx(Button, { className: "bg-slate-500", onClick: onRestart, children: "Back" })] })), started && (_jsxs(_Fragment, { children: [_jsx("div", { className: "max-h-80 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3", children: transcript.map((turn) => (_jsxs("div", { className: `rounded p-2 text-sm ${turn.speaker === "candidate" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`, children: [_jsxs("span", { className: "font-semibold capitalize", children: [turn.speaker, ":"] }), " ", turn.text] }, `${turn.id}-${turn.ts}`))) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm", value: input, onChange: (event) => setInput(event.target.value), onKeyDown: (event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        void submitAnswer();
                                                    }
                                                }, placeholder: "Type your answer" }), _jsx(Button, { onClick: submitAnswer, disabled: !isOnline || turnMutation.isPending, children: "Send" })] })] })), error && _jsx("p", { className: "text-sm text-red-700", children: error })] }) }), _jsx(LiveInsightsSidebar, { snapshot: scoringSnapshot, programFit: programFit, activeTraitId: currentQuestion?.traitId ?? null })] }) }));
};
const QuizFlow = ({ mode, programFilterIds, onRestart }) => {
    const navigate = useNavigate();
    const [started, setStarted] = useState(false);
    const [error, setError] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [askedTraitIds, setAskedTraitIds] = useState([]);
    const [askedQuestionIds, setAskedQuestionIds] = useState([]);
    const isOnline = useOnlineStatus();
    const { sessionId, scoringSnapshot, programFit, sessionLanguageTag, setSessionId, addTranscriptTurn, setMode, setProgramFilterIds, setScoringSnapshot, setProgramFit, clear } = useWidgetStore();
    const createInterviewMutation = useMutation({
        mutationFn: () => api.createInterviewSession({
            mode,
            language: sessionLanguageTag,
            programFilterIds: programFilterIds.length > 0 ? programFilterIds : undefined
        })
    });
    const turnMutation = useMutation({
        mutationFn: (text) => api.submitInterviewTurn(sessionId, {
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
            if (!id)
                throw new Error("Session id missing");
            setSessionId(id);
            setScoringSnapshot(session.scoring_snapshot ?? null);
            setProgramFit(session.program_fit ?? null);
            setStarted(true);
            setCurrentQuestion(session.nextQuestion ?? null);
        }
        catch (startError) {
            setError(startError instanceof Error ? startError.message : "Could not start quiz.");
        }
    };
    const selectAnswer = async (answer) => {
        if (!currentQuestion)
            return;
        addTranscriptTurn({ id: transcriptId("candidate"), speaker: "candidate", text: answer, ts: new Date().toISOString() });
        setAskedTraitIds((prev) => [...prev, currentQuestion.traitId]);
        setAskedQuestionIds((prev) => [...prev, currentQuestion.id]);
        try {
            const result = await turnMutation.mutateAsync(answer);
            setScoringSnapshot(result.scoring_snapshot);
            setProgramFit(result.program_fit);
            if (result.nextQuestion) {
                setCurrentQuestion(result.nextQuestion);
            }
            else {
                await api.completeSession(sessionId);
                navigate("/widget/results");
            }
        }
        catch (selectError) {
            setError(selectError instanceof Error ? selectError.message : "Could not submit quiz answer.");
        }
    };
    return (_jsx("main", { className: "mx-auto min-h-screen max-w-7xl px-4 py-8", children: _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]", children: [_jsx(Card, { children: _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Quiz" }), !started && (_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: startQuiz, disabled: !isOnline || createInterviewMutation.isPending, children: "Start quiz" }), _jsx(Button, { className: "bg-slate-500", onClick: onRestart, children: "Back" })] })), started && currentQuestion && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900", children: currentQuestion.prompt }), _jsx("div", { className: "grid gap-2", children: currentQuestion.options.map((option) => (_jsx("button", { type: "button", className: "rounded-md border border-slate-300 bg-white px-4 py-2 text-left text-sm hover:border-slate-900", onClick: () => void selectAnswer(option), disabled: !isOnline || turnMutation.isPending, children: option }, `${currentQuestion.id}-${option}`))) })] })), error && _jsx("p", { className: "text-sm text-red-700", children: error })] }) }), _jsx(LiveInsightsSidebar, { snapshot: scoringSnapshot, programFit: programFit, activeTraitId: currentQuestion?.traitId ?? null })] }) }));
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
    return (_jsx("main", { className: "mx-auto min-h-screen max-w-7xl px-4 py-8", children: _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]", children: [_jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-2xl font-semibold", children: "Results" }), _jsxs("p", { className: "text-sm text-slate-700", children: ["Interview mode: ", mode?.toUpperCase() ?? "N/A"] }), scorecard && _jsxs("p", { className: "text-sm text-slate-700", children: ["Overall score: ", scorecard.overallScore.toFixed(2), " / 5.00"] }), !scorecard && _jsx("p", { className: "text-sm text-slate-600", children: "Review rankings and trait evidence in the side panel." }), _jsxs("div", { className: "mt-4 rounded-md border border-slate-200 p-3", children: [_jsx("p", { className: "mb-2 text-sm font-semibold text-slate-900", children: "Request Info / Talk to an advisor" }), !leadSubmitted && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "First name", value: firstName, onChange: (event) => setFirstName(event.target.value) }), _jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Last name", value: lastName, onChange: (event) => setLastName(event.target.value) })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Email", type: "email", value: email, onChange: (event) => setEmail(event.target.value) }), _jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Phone (optional)", value: phone, onChange: (event) => setPhone(event.target.value) })] }), _jsxs("select", { className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm", value: preferredChannel, onChange: (event) => setPreferredChannel(event.target.value), children: [_jsx("option", { value: "email", children: "Email" }), _jsx("option", { value: "sms", children: "SMS" }), _jsx("option", { value: "phone", children: "Phone" })] }), _jsx(Button, { onClick: submitLead, disabled: createLeadMutation.isPending, children: createLeadMutation.isPending ? "Submitting..." : "Request Info" }), leadValidationError && _jsx("p", { className: "text-sm text-red-700", children: leadValidationError })] })), leadSubmitted && _jsx("p", { className: "text-sm text-emerald-700", children: "Thanks - we'll reach out soon." })] }), _jsx(Button, { className: "mt-4 bg-slate-500", onClick: () => navigate("/widget"), children: "Start over" })] }), _jsx(LiveInsightsSidebar, { snapshot: scoringSnapshot, programFit: programFit, done: true })] }) }));
};
const App = () => (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/widget", replace: true }) }), _jsx(Route, { path: "/widget", element: _jsx(WidgetSetup, {}) }), _jsx(Route, { path: "/widget/results", element: _jsx(ResultsPage, {}) })] }) }));
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(App, {}) }) }));

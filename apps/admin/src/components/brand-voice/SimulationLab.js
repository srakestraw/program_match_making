import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const panelClass = "rounded-md border border-slate-200 bg-white p-3";
const defaultPersona = "STUDENT";
const personaOptions = ["STUDENT", "PARENT", "INTERNATIONAL"];
const personaLabel = (value) => value.charAt(0) + value.slice(1).toLowerCase();
const toTranscript = (turns) => turns.map((turn) => `${turn.role}: ${turn.content}`).join("\n\n");
const getVoiceMatchSummary = (score, avoidHitCount) => {
    if (score === null) {
        return {
            label: "-",
            reason: "Run a simulation to evaluate voice match."
        };
    }
    if (score >= 90 && avoidHitCount === 0) {
        return {
            label: "Strong match",
            reason: "Consistent tone and no avoid-flag hits in this run."
        };
    }
    if (score >= 75) {
        return {
            label: "Good match",
            reason: avoidHitCount > 0 ? "Mostly aligned, with a few avoid-flag hits." : "Aligned tone with room to tighten consistency."
        };
    }
    return {
        label: "Needs tuning",
        reason: avoidHitCount > 0 ? "Tone drift and avoid-flag hits were detected." : "Tone consistency dropped during this run."
    };
};
export function SimulationLab({ brandVoiceId, request }) {
    const [scenarios, setScenarios] = useState([]);
    const [selectedScenarioId, setSelectedScenarioId] = useState(null);
    const [personaMode, setPersonaMode] = useState("AUTO");
    const [customScenario, setCustomScenario] = useState("");
    const [useCustomScenario, setUseCustomScenario] = useState(false);
    const [simulationId, setSimulationId] = useState(null);
    const [turns, setTurns] = useState([]);
    const [userMessage, setUserMessage] = useState("");
    const [stabilityScore, setStabilityScore] = useState(null);
    const [avoidHits, setAvoidHits] = useState([]);
    const [voiceUrl, setVoiceUrl] = useState(null);
    const [pressureSummary, setPressureSummary] = useState([]);
    const [isWorking, setIsWorking] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        const loadScenarios = async () => {
            try {
                const payload = await request("/api/admin/simulation-scenarios");
                setScenarios(payload.data);
                if (payload.data.length > 0) {
                    setSelectedScenarioId(payload.data[0]?.id ?? null);
                }
            }
            catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load scenarios");
            }
        };
        void loadScenarios();
    }, [request]);
    useEffect(() => {
        setSimulationId(null);
        setTurns([]);
        setStabilityScore(null);
        setAvoidHits([]);
        setVoiceUrl(null);
        setPressureSummary([]);
        setError(null);
        setUserMessage("");
    }, [brandVoiceId]);
    const featuredScenarios = useMemo(() => {
        const presets = scenarios.filter((scenario) => scenario.isPreset);
        return (presets.length > 0 ? presets : scenarios).slice(0, 6);
    }, [scenarios]);
    const selectedScenario = useMemo(() => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null, [scenarios, selectedScenarioId]);
    const resolvedPersona = useMemo(() => {
        if (personaMode !== "AUTO") {
            return personaMode;
        }
        return selectedScenario?.persona ?? defaultPersona;
    }, [personaMode, selectedScenario]);
    const hasValidSetup = useCustomScenario ? customScenario.trim().length > 0 : Boolean(selectedScenarioId);
    const startSimulation = async () => {
        if (!brandVoiceId) {
            setError("Create and save a brand voice before running simulations.");
            return;
        }
        if (!hasValidSetup) {
            setError("Choose a scenario or enter a custom scenario.");
            return;
        }
        setError(null);
        setIsWorking(true);
        try {
            const payload = await request(`/api/admin/brand-voices/${brandVoiceId}/simulations`, {
                method: "POST",
                body: JSON.stringify({
                    scenarioId: useCustomScenario ? undefined : selectedScenarioId ?? undefined,
                    persona: resolvedPersona,
                    customScenario: useCustomScenario ? customScenario.trim() : undefined
                })
            });
            setSimulationId(payload.simulation.id);
            setTurns(payload.turns);
            const firstAssistant = await request(`/api/admin/simulations/${payload.simulation.id}/turns`, {
                method: "POST",
                body: JSON.stringify({})
            });
            setTurns((prev) => [...prev, firstAssistant.assistantTurn]);
            setStabilityScore(firstAssistant.stabilityScore);
            setAvoidHits(firstAssistant.avoidHits);
            setVoiceUrl(null);
            setPressureSummary([]);
            setUserMessage("");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start simulation");
        }
        finally {
            setIsWorking(false);
        }
    };
    const sendMessage = async () => {
        if (!simulationId) {
            setError("Start a simulation first.");
            return;
        }
        setError(null);
        setIsWorking(true);
        try {
            const payload = await request(`/api/admin/simulations/${simulationId}/turns`, {
                method: "POST",
                body: JSON.stringify({ userMessage: userMessage.trim() || undefined })
            });
            setTurns((prev) => [...prev, ...(payload.userTurn ? [payload.userTurn] : []), payload.assistantTurn]);
            setStabilityScore(payload.stabilityScore);
            setAvoidHits(payload.avoidHits);
            setUserMessage("");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send message");
        }
        finally {
            setIsWorking(false);
        }
    };
    const runPressureTest = async () => {
        if (!simulationId) {
            setError("Start a simulation first.");
            return;
        }
        setError(null);
        setIsWorking(true);
        try {
            const payload = await request(`/api/admin/simulations/${simulationId}/pressure-test`, {
                method: "POST",
                body: JSON.stringify({})
            });
            setTurns(payload.transcript);
            setStabilityScore(payload.aggregatedScore);
            setPressureSummary(payload.avoidHitsSummary);
            setAvoidHits(payload.avoidHitsSummary.map((item) => item.token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed pressure test");
        }
        finally {
            setIsWorking(false);
        }
    };
    const generateVoiceSample = async () => {
        if (!simulationId) {
            setError("Start a simulation first.");
            return;
        }
        const lastAssistantTurn = [...turns].reverse().find((turn) => turn.role === "ASSISTANT");
        if (!lastAssistantTurn) {
            setError("Run at least one assistant turn before generating voice.");
            return;
        }
        setError(null);
        setIsWorking(true);
        try {
            const payload = await request(`/api/admin/simulations/${simulationId}/voice-samples`, {
                method: "POST",
                body: JSON.stringify({ turnId: lastAssistantTurn.id })
            });
            setVoiceUrl(payload.data.audioUrl);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate voice sample");
        }
        finally {
            setIsWorking(false);
        }
    };
    const copyTranscript = async () => {
        if (turns.length === 0) {
            return;
        }
        const transcript = toTranscript(turns);
        try {
            await navigator.clipboard.writeText(transcript);
        }
        catch {
            setError("Clipboard is unavailable in this browser context.");
        }
    };
    const voiceMatch = getVoiceMatchSummary(stabilityScore, avoidHits.length);
    return (_jsxs("div", { className: "grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]", children: [_jsxs("div", { className: panelClass, children: [_jsx("h3", { className: "mb-1 text-sm font-semibold", children: "Setup" }), _jsx("p", { className: "mb-3 text-xs text-slate-600", children: "1. Choose a scenario 2. Start simulation 3. Chat and review voice match" }), _jsxs("div", { children: [_jsx("div", { className: "mb-1 text-xs font-medium uppercase tracking-wide text-slate-600", children: "Scenario" }), _jsx("div", { className: "space-y-1", children: featuredScenarios.map((scenario) => (_jsxs("button", { type: "button", onClick: () => {
                                        setSelectedScenarioId(scenario.id);
                                        setUseCustomScenario(false);
                                        setCustomScenario("");
                                    }, className: `w-full rounded border px-2 py-1.5 text-left text-xs ${selectedScenarioId === scenario.id && !useCustomScenario
                                        ? "border-slate-900 bg-slate-100"
                                        : "border-slate-200 hover:bg-slate-50"}`, children: [_jsx("div", { className: "font-medium", children: scenario.title }), _jsxs("div", { className: "text-[11px] text-slate-500", children: [scenario.stage.toLowerCase(), " \u00B7 ", personaLabel((scenario.persona ?? defaultPersona))] })] }, scenario.id))) })] }), _jsx("button", { type: "button", className: `mt-3 w-full rounded-md border px-3 py-2 text-sm font-medium ${useCustomScenario ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:bg-slate-50"}`, onClick: () => setUseCustomScenario((prev) => !prev), children: useCustomScenario ? "Using custom scenario" : "Use custom scenario" }), useCustomScenario && (_jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600", children: "Custom scenario" }), _jsx("textarea", { className: inputClass, rows: 4, value: customScenario, onChange: (event) => setCustomScenario(event.target.value), placeholder: "Describe a custom admissions scenario" })] })), _jsxs("div", { className: "mt-3 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700", children: ["Persona: ", _jsx("span", { className: "font-medium", children: personaLabel(resolvedPersona) })] }), _jsxs("details", { className: "mt-3 rounded border border-slate-200 p-2", children: [_jsx("summary", { className: "cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-600", children: "Advanced setup" }), _jsxs("div", { className: "mt-2", children: [_jsx("label", { className: "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600", children: "Persona mode" }), _jsxs("select", { className: inputClass, value: personaMode, onChange: (event) => setPersonaMode(event.target.value), children: [_jsx("option", { value: "AUTO", children: "Auto from scenario" }), personaOptions.map((item) => (_jsx("option", { value: item, children: personaLabel(item) }, item)))] })] })] }), _jsx("button", { type: "button", className: "mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60", onClick: () => void startSimulation(), disabled: isWorking || !brandVoiceId || !hasValidSetup, children: "Start simulation" })] }), _jsxs("div", { className: panelClass, children: [_jsx("h3", { className: "mb-2 text-sm font-semibold", children: "Chat" }), _jsxs("div", { className: "mb-3 rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "font-medium", children: "Voice match" }), _jsx("div", { className: "text-lg font-semibold", children: voiceMatch.label }), _jsx("div", { className: "text-xs text-slate-600", children: voiceMatch.reason })] }), _jsxs("div", { className: "max-h-[460px] space-y-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-2", children: [turns.length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "Start a simulation to begin the conversation." }), turns.map((turn) => (_jsxs("div", { className: `max-w-[85%] rounded px-3 py-2 text-sm ${turn.role === "ASSISTANT"
                                    ? "ml-auto border border-blue-200 bg-blue-50"
                                    : turn.role === "SYSTEM"
                                        ? "mx-auto border border-slate-300 bg-slate-100 text-xs"
                                        : "mr-auto border border-slate-300 bg-white"}`, children: [_jsx("div", { className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500", children: turn.role }), _jsx("div", { children: turn.content })] }, turn.id)))] }), _jsxs("form", { className: "mt-3 flex gap-2", onSubmit: (event) => {
                            event.preventDefault();
                            void sendMessage();
                        }, children: [_jsx("input", { className: inputClass, placeholder: "Type a candidate message", value: userMessage, onChange: (event) => setUserMessage(event.target.value), disabled: !simulationId || isWorking }), _jsx("button", { type: "submit", className: "rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60", disabled: !simulationId || isWorking, children: "Send" })] }), _jsxs("details", { className: "mt-3 rounded border border-slate-200 p-2", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium", children: "Advanced tools" }), _jsxs("div", { className: "mt-2 space-y-2", children: [_jsx("button", { type: "button", className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void runPressureTest(), disabled: !simulationId || isWorking, children: "Pressure test" }), _jsx("button", { type: "button", className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void generateVoiceSample(), disabled: !simulationId || isWorking || !turns.some((turn) => turn.role === "ASSISTANT"), children: "Generate voice sample" }), _jsx("button", { type: "button", className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void copyTranscript(), disabled: turns.length === 0, children: "Copy transcript" })] }), _jsxs("div", { className: "mt-3 rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "font-medium", children: "Stability score" }), _jsx("div", { className: "text-lg font-semibold", children: stabilityScore ?? "-" })] }), _jsxs("div", { className: "mt-3 rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "mb-1 font-medium", children: "Avoid hits" }), avoidHits.length === 0 ? (_jsx("div", { className: "text-slate-500", children: "None" })) : (_jsx("div", { className: "flex flex-wrap gap-1", children: avoidHits.map((hit) => (_jsx("span", { className: "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700", children: hit }, hit))) })), pressureSummary.length > 0 && (_jsx("div", { className: "mt-2 space-y-1 text-xs text-slate-600", children: pressureSummary.map((item) => (_jsxs("div", { children: [item.token, ": ", item.count] }, item.token))) }))] }), voiceUrl && (_jsxs("div", { className: "mt-3 min-w-0 rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "mb-1 font-medium", children: "Voice sample" }), _jsx("a", { className: "block break-all text-blue-700 underline", href: voiceUrl, target: "_blank", rel: "noreferrer", title: voiceUrl, children: "Open sample audio" }), _jsx("audio", { className: "mt-2 block w-full max-w-full", controls: true, preload: "metadata", src: voiceUrl })] }))] }), error && _jsx("p", { className: "mt-3 text-sm text-red-700", children: error })] })] }));
}

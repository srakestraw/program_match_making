import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const panelClass = "rounded-md border border-slate-200 bg-white p-3";
const stageOrder = ["AWARENESS", "CONSIDERATION", "OBJECTION"];
const personaOptions = ["STUDENT", "PARENT", "INTERNATIONAL"];
const personaLabel = (value) => value.charAt(0) + value.slice(1).toLowerCase();
const toTranscript = (turns) => turns.map((turn) => `${turn.role}: ${turn.content}`).join("\n\n");
export function SimulationLab({ brandVoiceId, request }) {
    const [scenarios, setScenarios] = useState([]);
    const [selectedScenarioId, setSelectedScenarioId] = useState(null);
    const [persona, setPersona] = useState("STUDENT");
    const [customScenario, setCustomScenario] = useState("");
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
    }, [brandVoiceId]);
    const groupedScenarios = useMemo(() => {
        return stageOrder.map((stage) => ({
            stage,
            items: scenarios.filter((scenario) => scenario.stage === stage)
        }));
    }, [scenarios]);
    const startSimulation = async () => {
        if (!brandVoiceId) {
            setError("Create and save a brand voice before running simulations.");
            return;
        }
        setError(null);
        setIsWorking(true);
        try {
            const payload = await request(`/api/admin/brand-voices/${brandVoiceId}/simulations`, {
                method: "POST",
                body: JSON.stringify({
                    scenarioId: customScenario.trim().length > 0 ? undefined : selectedScenarioId ?? undefined,
                    persona,
                    customScenario: customScenario.trim().length > 0 ? customScenario.trim() : undefined
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start simulation");
        }
        finally {
            setIsWorking(false);
        }
    };
    const runTurn = async () => {
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
            setError(err instanceof Error ? err.message : "Failed to run turn");
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
    return (_jsxs("div", { className: "grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)_280px]", children: [_jsxs("div", { className: panelClass, children: [_jsx("h3", { className: "mb-2 text-sm font-semibold", children: "Scenarios" }), _jsx("div", { className: "space-y-3", children: groupedScenarios.map((group) => (_jsxs("div", { children: [_jsx("div", { className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500", children: group.stage }), _jsx("div", { className: "space-y-1", children: group.items.map((scenario) => (_jsxs("button", { type: "button", onClick: () => {
                                            setSelectedScenarioId(scenario.id);
                                            setCustomScenario("");
                                        }, className: `w-full rounded border px-2 py-1 text-left text-xs ${selectedScenarioId === scenario.id && customScenario.trim().length === 0
                                            ? "border-slate-900 bg-slate-100"
                                            : "border-slate-200"}`, children: [_jsx("div", { className: "font-medium", children: scenario.title }), scenario.persona && _jsx("div", { className: "text-[11px] text-slate-500", children: scenario.persona })] }, scenario.id))) })] }, group.stage))) }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600", children: "Custom scenario" }), _jsx("textarea", { className: inputClass, rows: 4, value: customScenario, onChange: (event) => setCustomScenario(event.target.value), placeholder: "Describe a custom admissions scenario" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600", children: "Persona" }), _jsx("select", { className: inputClass, value: persona, onChange: (event) => setPersona(event.target.value), children: personaOptions.map((item) => (_jsx("option", { value: item, children: personaLabel(item) }, item))) })] }), _jsx("button", { type: "button", className: "mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60", onClick: () => void startSimulation(), disabled: isWorking || !brandVoiceId || (!selectedScenarioId && customScenario.trim().length === 0), children: "Start simulation" })] }), _jsxs("div", { className: panelClass, children: [_jsx("h3", { className: "mb-2 text-sm font-semibold", children: "Transcript" }), _jsxs("div", { className: "max-h-[460px] space-y-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-2", children: [turns.length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "Start a simulation to see conversation turns." }), turns.map((turn) => (_jsxs("div", { className: `max-w-[85%] rounded px-3 py-2 text-sm ${turn.role === "ASSISTANT"
                                    ? "ml-auto border border-blue-200 bg-blue-50"
                                    : turn.role === "SYSTEM"
                                        ? "mx-auto border border-slate-300 bg-slate-100 text-xs"
                                        : "mr-auto border border-slate-300 bg-white"}`, children: [_jsx("div", { className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500", children: turn.role }), _jsx("div", { children: turn.content })] }, turn.id)))] }), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsx("input", { className: inputClass, placeholder: "Add user message", value: userMessage, onChange: (event) => setUserMessage(event.target.value) }), _jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void runTurn(), disabled: !simulationId || isWorking, children: "Run turn" })] })] }), _jsxs("div", { className: panelClass, children: [_jsx("h3", { className: "mb-2 text-sm font-semibold", children: "Controls + Output" }), _jsxs("div", { className: "space-y-2", children: [_jsx("button", { type: "button", className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void runPressureTest(), disabled: !simulationId || isWorking, children: "Pressure test" }), _jsx("button", { type: "button", className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void generateVoiceSample(), disabled: !simulationId || isWorking || !turns.some((turn) => turn.role === "ASSISTANT"), children: "Generate voice sample" }), _jsx("button", { type: "button", className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void copyTranscript(), disabled: turns.length === 0, children: "Copy transcript" })] }), _jsxs("div", { className: "mt-3 rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "font-medium", children: "Stability score" }), _jsx("div", { className: "text-lg font-semibold", children: stabilityScore ?? "-" })] }), _jsxs("div", { className: "mt-3 rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "mb-1 font-medium", children: "Avoid hits" }), avoidHits.length === 0 ? (_jsx("div", { className: "text-slate-500", children: "None" })) : (_jsx("div", { className: "flex flex-wrap gap-1", children: avoidHits.map((hit) => (_jsx("span", { className: "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700", children: hit }, hit))) })), pressureSummary.length > 0 && (_jsx("div", { className: "mt-2 space-y-1 text-xs text-slate-600", children: pressureSummary.map((item) => (_jsxs("div", { children: [item.token, ": ", item.count] }, item.token))) }))] }), voiceUrl && (_jsxs("div", { className: "mt-3 min-w-0 rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "mb-1 font-medium", children: "Voice sample" }), _jsx("a", { className: "block break-all text-blue-700 underline", href: voiceUrl, target: "_blank", rel: "noreferrer", title: voiceUrl, children: "Open sample audio" }), _jsx("audio", { className: "mt-2 block w-full max-w-full", controls: true, preload: "metadata", src: voiceUrl })] })), error && _jsx("p", { className: "mt-3 text-sm text-red-700", children: error })] })] }));
}

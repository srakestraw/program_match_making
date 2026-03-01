import React, { useEffect, useMemo, useState } from "react";

type Scenario = {
  id: string;
  title: string;
  stage: "AWARENESS" | "CONSIDERATION" | "OBJECTION";
  persona: "STUDENT" | "PARENT" | "INTERNATIONAL" | null;
  seedPrompt: string;
  isPreset: boolean;
};

type Turn = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  order: number;
  createdAt: string;
};

type Persona = "STUDENT" | "PARENT" | "INTERNATIONAL";
type PersonaMode = Persona | "AUTO";

type RequestFn = <T>(path: string, init?: RequestInit) => Promise<T>;

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const panelClass = "rounded-md border border-slate-200 bg-white p-3";
const defaultPersona: Persona = "STUDENT";
const personaOptions: Persona[] = ["STUDENT", "PARENT", "INTERNATIONAL"];

const personaLabel = (value: Persona) => value.charAt(0) + value.slice(1).toLowerCase();

const toTranscript = (turns: Turn[]) => turns.map((turn) => `${turn.role}: ${turn.content}`).join("\n\n");

const getVoiceMatchSummary = (score: number | null, avoidHitCount: number) => {
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

export function SimulationLab({
  brandVoiceId,
  request
}: {
  brandVoiceId: string | null;
  request: RequestFn;
}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [personaMode, setPersonaMode] = useState<PersonaMode>("AUTO");
  const [customScenario, setCustomScenario] = useState("");
  const [useCustomScenario, setUseCustomScenario] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [stabilityScore, setStabilityScore] = useState<number | null>(null);
  const [avoidHits, setAvoidHits] = useState<string[]>([]);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [pressureSummary, setPressureSummary] = useState<Array<{ token: string; count: number }>>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const payload = await request<{ data: Scenario[] }>("/api/admin/simulation-scenarios");
        setScenarios(payload.data);
        if (payload.data.length > 0) {
          setSelectedScenarioId(payload.data[0]?.id ?? null);
        }
      } catch (err) {
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

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId]
  );

  const resolvedPersona: Persona = useMemo(() => {
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
      const payload = await request<{ simulation: { id: string }; turns: Turn[] }>(
        `/api/admin/brand-voices/${brandVoiceId}/simulations`,
        {
          method: "POST",
          body: JSON.stringify({
            scenarioId: useCustomScenario ? undefined : selectedScenarioId ?? undefined,
            persona: resolvedPersona,
            customScenario: useCustomScenario ? customScenario.trim() : undefined
          })
        }
      );

      setSimulationId(payload.simulation.id);
      setTurns(payload.turns);

      const firstAssistant = await request<{
        assistantTurn: Turn;
        stabilityScore: number;
        avoidHits: string[];
      }>(`/api/admin/simulations/${payload.simulation.id}/turns`, {
        method: "POST",
        body: JSON.stringify({})
      });

      setTurns((prev) => [...prev, firstAssistant.assistantTurn]);
      setStabilityScore(firstAssistant.stabilityScore);
      setAvoidHits(firstAssistant.avoidHits);
      setVoiceUrl(null);
      setPressureSummary([]);
      setUserMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start simulation");
    } finally {
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
      const payload = await request<{
        userTurn?: Turn;
        assistantTurn: Turn;
        stabilityScore: number;
        avoidHits: string[];
      }>(`/api/admin/simulations/${simulationId}/turns`, {
        method: "POST",
        body: JSON.stringify({ userMessage: userMessage.trim() || undefined })
      });

      setTurns((prev) => [...prev, ...(payload.userTurn ? [payload.userTurn] : []), payload.assistantTurn]);
      setStabilityScore(payload.stabilityScore);
      setAvoidHits(payload.avoidHits);
      setUserMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
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
      const payload = await request<{
        transcript: Turn[];
        aggregatedScore: number | null;
        avoidHitsSummary: Array<{ token: string; count: number }>;
      }>(`/api/admin/simulations/${simulationId}/pressure-test`, {
        method: "POST",
        body: JSON.stringify({})
      });

      setTurns(payload.transcript);
      setStabilityScore(payload.aggregatedScore);
      setPressureSummary(payload.avoidHitsSummary);
      setAvoidHits(payload.avoidHitsSummary.map((item) => item.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed pressure test");
    } finally {
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
      const payload = await request<{ data: { audioUrl: string } }>(`/api/admin/simulations/${simulationId}/voice-samples`, {
        method: "POST",
        body: JSON.stringify({ turnId: lastAssistantTurn.id })
      });
      setVoiceUrl(payload.data.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate voice sample");
    } finally {
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
    } catch {
      setError("Clipboard is unavailable in this browser context.");
    }
  };

  const voiceMatch = getVoiceMatchSummary(stabilityScore, avoidHits.length);

  return (
    <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className={panelClass}>
        <h3 className="mb-1 text-sm font-semibold">Setup</h3>
        <p className="mb-3 text-xs text-slate-600">1. Choose a scenario 2. Start simulation 3. Chat and review voice match</p>

        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-600">Scenario</div>
          <div className="space-y-1">
            {featuredScenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => {
                  setSelectedScenarioId(scenario.id);
                  setUseCustomScenario(false);
                  setCustomScenario("");
                }}
                className={`w-full rounded border px-2 py-1.5 text-left text-xs ${
                  selectedScenarioId === scenario.id && !useCustomScenario
                    ? "border-slate-900 bg-slate-100"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="font-medium">{scenario.title}</div>
                <div className="text-[11px] text-slate-500">
                  {scenario.stage.toLowerCase()} · {personaLabel((scenario.persona ?? defaultPersona) as Persona)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={`mt-3 w-full rounded-md border px-3 py-2 text-sm font-medium ${
            useCustomScenario ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:bg-slate-50"
          }`}
          onClick={() => setUseCustomScenario((prev) => !prev)}
        >
          {useCustomScenario ? "Using custom scenario" : "Use custom scenario"}
        </button>

        {useCustomScenario && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Custom scenario</label>
            <textarea
              className={inputClass}
              rows={4}
              value={customScenario}
              onChange={(event) => setCustomScenario(event.target.value)}
              placeholder="Describe a custom admissions scenario"
            />
          </div>
        )}

        <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
          Persona: <span className="font-medium">{personaLabel(resolvedPersona)}</span>
        </div>

        <details className="mt-3 rounded border border-slate-200 p-2">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-600">Advanced setup</summary>
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Persona mode</label>
            <select className={inputClass} value={personaMode} onChange={(event) => setPersonaMode(event.target.value as PersonaMode)}>
              <option value="AUTO">Auto from scenario</option>
              {personaOptions.map((item) => (
                <option key={item} value={item}>
                  {personaLabel(item)}
                </option>
              ))}
            </select>
          </div>
        </details>

        <button
          type="button"
          className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => void startSimulation()}
          disabled={isWorking || !brandVoiceId || !hasValidSetup}
        >
          Start simulation
        </button>
      </div>

      <div className={panelClass}>
        <h3 className="mb-2 text-sm font-semibold">Chat</h3>

        <div className="mb-3 rounded border border-slate-200 p-2 text-sm">
          <div className="font-medium">Voice match</div>
          <div className="text-lg font-semibold">{voiceMatch.label}</div>
          <div className="text-xs text-slate-600">{voiceMatch.reason}</div>
        </div>

        <div className="max-h-[460px] space-y-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-2">
          {turns.length === 0 && <p className="text-sm text-slate-500">Start a simulation to begin the conversation.</p>}
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={`max-w-[85%] rounded px-3 py-2 text-sm ${
                turn.role === "ASSISTANT"
                  ? "ml-auto border border-blue-200 bg-blue-50"
                  : turn.role === "SYSTEM"
                  ? "mx-auto border border-slate-300 bg-slate-100 text-xs"
                  : "mr-auto border border-slate-300 bg-white"
              }`}
            >
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{turn.role}</div>
              <div>{turn.content}</div>
            </div>
          ))}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            className={inputClass}
            placeholder="Type a candidate message"
            value={userMessage}
            onChange={(event) => setUserMessage(event.target.value)}
            disabled={!simulationId || isWorking}
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            disabled={!simulationId || isWorking}
          >
            Send
          </button>
        </form>

        <details className="mt-3 rounded border border-slate-200 p-2">
          <summary className="cursor-pointer text-sm font-medium">Advanced tools</summary>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void runPressureTest()}
              disabled={!simulationId || isWorking}
            >
              Pressure test
            </button>
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void generateVoiceSample()}
              disabled={!simulationId || isWorking || !turns.some((turn) => turn.role === "ASSISTANT")}
            >
              Generate voice sample
            </button>
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void copyTranscript()}
              disabled={turns.length === 0}
            >
              Copy transcript
            </button>
          </div>

          <div className="mt-3 rounded border border-slate-200 p-2 text-sm">
            <div className="font-medium">Stability score</div>
            <div className="text-lg font-semibold">{stabilityScore ?? "-"}</div>
          </div>

          <div className="mt-3 rounded border border-slate-200 p-2 text-sm">
            <div className="mb-1 font-medium">Avoid hits</div>
            {avoidHits.length === 0 ? (
              <div className="text-slate-500">None</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {avoidHits.map((hit) => (
                  <span key={hit} className="rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                    {hit}
                  </span>
                ))}
              </div>
            )}
            {pressureSummary.length > 0 && (
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {pressureSummary.map((item) => (
                  <div key={item.token}>
                    {item.token}: {item.count}
                  </div>
                ))}
              </div>
            )}
          </div>

          {voiceUrl && (
            <div className="mt-3 min-w-0 rounded border border-slate-200 p-2 text-sm">
              <div className="mb-1 font-medium">Voice sample</div>
              <a
                className="block break-all text-blue-700 underline"
                href={voiceUrl}
                target="_blank"
                rel="noreferrer"
                title={voiceUrl}
              >
                Open sample audio
              </a>
              <audio className="mt-2 block w-full max-w-full" controls preload="metadata" src={voiceUrl} />
            </div>
          )}
        </details>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}

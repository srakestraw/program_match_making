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

type RequestFn = <T>(path: string, init?: RequestInit) => Promise<T>;

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const panelClass = "rounded-md border border-slate-200 bg-white p-3";
const stageOrder: Array<Scenario["stage"]> = ["AWARENESS", "CONSIDERATION", "OBJECTION"];
const personaOptions: Persona[] = ["STUDENT", "PARENT", "INTERNATIONAL"];

const personaLabel = (value: Persona) => value.charAt(0) + value.slice(1).toLowerCase();

const toTranscript = (turns: Turn[]) => turns.map((turn) => `${turn.role}: ${turn.content}`).join("\n\n");

export function SimulationLab({
  brandVoiceId,
  request
}: {
  brandVoiceId: string | null;
  request: RequestFn;
}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [persona, setPersona] = useState<Persona>("STUDENT");
  const [customScenario, setCustomScenario] = useState("");
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
      const payload = await request<{ simulation: { id: string }; turns: Turn[] }>(
        `/api/admin/brand-voices/${brandVoiceId}/simulations`,
        {
          method: "POST",
          body: JSON.stringify({
            scenarioId: customScenario.trim().length > 0 ? undefined : selectedScenarioId ?? undefined,
            persona,
            customScenario: customScenario.trim().length > 0 ? customScenario.trim() : undefined
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start simulation");
    } finally {
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
      setError(err instanceof Error ? err.message : "Failed to run turn");
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

  return (
    <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
      <div className={panelClass}>
        <h3 className="mb-2 text-sm font-semibold">Scenarios</h3>
        <div className="space-y-3">
          {groupedScenarios.map((group) => (
            <div key={group.stage}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.stage}</div>
              <div className="space-y-1">
                {group.items.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => {
                      setSelectedScenarioId(scenario.id);
                      setCustomScenario("");
                    }}
                    className={`w-full rounded border px-2 py-1 text-left text-xs ${
                      selectedScenarioId === scenario.id && customScenario.trim().length === 0
                        ? "border-slate-900 bg-slate-100"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="font-medium">{scenario.title}</div>
                    {scenario.persona && <div className="text-[11px] text-slate-500">{scenario.persona}</div>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

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

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Persona</label>
          <select className={inputClass} value={persona} onChange={(event) => setPersona(event.target.value as Persona)}>
            {personaOptions.map((item) => (
              <option key={item} value={item}>
                {personaLabel(item)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => void startSimulation()}
          disabled={isWorking || !brandVoiceId || (!selectedScenarioId && customScenario.trim().length === 0)}
        >
          Start simulation
        </button>
      </div>

      <div className={panelClass}>
        <h3 className="mb-2 text-sm font-semibold">Transcript</h3>
        <div className="max-h-[460px] space-y-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-2">
          {turns.length === 0 && <p className="text-sm text-slate-500">Start a simulation to see conversation turns.</p>}
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

        <div className="mt-3 flex gap-2">
          <input
            className={inputClass}
            placeholder="Add user message"
            value={userMessage}
            onChange={(event) => setUserMessage(event.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void runTurn()}
            disabled={!simulationId || isWorking}
          >
            Run turn
          </button>
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="mb-2 text-sm font-semibold">Controls + Output</h3>
        <div className="space-y-2">
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

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}

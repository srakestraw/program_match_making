import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { AppShell, Button, Card } from "@pmm/ui";
import { createApiClient, type LeadStatus } from "@pmm/api-client";
import "./styles.css";

const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000" });
const queryClient = new QueryClient();

const leadStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "APPLIED", "DISQUALIFIED"];
const terminalCallStatuses = new Set(["COMPLETED", "FAILED", "NO_ANSWER", "BUSY", "CANCELED"]);

const formatCandidateName = (candidate: { firstName: string | null; lastName: string | null }) =>
  [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") || "Unknown";

const confidenceLabel = (value: number | null) => {
  if (value === null) return "-";
  if (value >= 0.75) return "High";
  if (value >= 0.5) return "Medium";
  return "Low";
};

const LeadQueuePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") as LeadStatus | null) ?? "";
  const programId = searchParams.get("programId") ?? "";
  const mode = searchParams.get("mode") ?? "";
  const q = searchParams.get("q") ?? "";

  const leadsQuery = useQuery({
    queryKey: ["advisor-leads", status, programId, mode, q],
    queryFn: async () => {
      const response = await api.getAdvisorLeads({
        status: (status || undefined) as LeadStatus | undefined,
        programId: programId || undefined,
        mode: (mode || undefined) as "voice" | "chat" | "quiz" | undefined,
        q: q || undefined,
        limit: 50,
        offset: 0
      });
      return response.data;
    }
  });

  const programsQuery = useQuery({
    queryKey: ["advisor-programs"],
    queryFn: async () => {
      const response = await api.getAdvisorPrograms();
      return response.data;
    }
  });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="mb-4 text-3xl font-bold">Lead Queue</h1>

        <Card>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Search name, email, phone"
              value={q}
              onChange={(event) => setFilter("q", event.target.value)}
            />
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {leadStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={programId}
              onChange={(event) => setFilter("programId", event.target.value)}
            >
              <option value="">All programs</option>
              {(programsQuery.data ?? []).map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={mode}
              onChange={(event) => setFilter("mode", event.target.value)}
            >
              <option value="">All modes</option>
              <option value="voice">voice</option>
              <option value="chat">chat</option>
              <option value="quiz">quiz</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Candidate</th>
                  <th className="px-2 py-2">Program</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Mode</th>
                  <th className="px-2 py-2">Started</th>
                  <th className="px-2 py-2">Completed</th>
                  <th className="px-2 py-2">Score</th>
                  <th className="px-2 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {(leadsQuery.data ?? []).map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <td className="px-2 py-2">{formatCandidateName(lead.candidate)}</td>
                    <td className="px-2 py-2">{lead.program?.name ?? "-"}</td>
                    <td className="px-2 py-2">{lead.status}</td>
                    <td className="px-2 py-2">
                      {lead.latestSession ? `${lead.latestSession.mode} (${lead.latestSession.channel})` : "-"}
                    </td>
                    <td className="px-2 py-2">{lead.latestSession?.startedAt ? new Date(lead.latestSession.startedAt).toLocaleString() : "-"}</td>
                    <td className="px-2 py-2">{lead.latestSession?.endedAt ? new Date(lead.latestSession.endedAt).toLocaleString() : "-"}</td>
                    <td className="px-2 py-2">{lead.scoreSummary ? lead.scoreSummary.overallScore.toFixed(2) : "-"}</td>
                    <td className="px-2 py-2">{confidenceLabel(lead.scoreSummary?.confidence ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!leadsQuery.isLoading && (leadsQuery.data ?? []).length === 0 && (
            <p className="mt-3 text-sm text-slate-600">No results. Try clearing filters or broadening your search.</p>
          )}
          {leadsQuery.isLoading && <p className="mt-3 text-sm text-slate-500">Loading leads...</p>}
          {leadsQuery.error && <p className="mt-3 text-sm text-red-700">Failed to load leads.</p>}
        </Card>
      </main>
    </AppShell>
  );
};

const LeadDetailPage = () => {
  const { id = "" } = useParams();
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<LeadStatus>("NEW");
  const [lastContactedAt, setLastContactedAt] = useState("");
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [toPhone, setToPhone] = useState("");
  const [fromPhone, setFromPhone] = useState("");
  const [smsBody, setSmsBody] = useState("");

  const detailQuery = useQuery({
    queryKey: ["advisor-lead-detail", id, selectedSessionId],
    queryFn: async () => {
      const response = await api.getAdvisorLeadDetail(id, selectedSessionId);
      return response.data;
    },
    enabled: id.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      const latestCall = data?.sessions?.[0]?.callSessions?.[0];
      if (!latestCall) return false;
      return terminalCallStatuses.has(latestCall.status) ? false : 5000;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.updateAdvisorLead(id, {
        status,
        owner: owner || null,
        notes: notes || null,
        lastContactedAt: lastContactedAt ? new Date(lastContactedAt).toISOString() : null
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["advisor-lead-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["advisor-leads"] });
    }
  });
  const startCallMutation = useMutation({
    mutationFn: async () =>
      api.createPhoneCall({
        leadId: id,
        toPhone,
        ...(fromPhone.trim() ? { fromPhone } : {}),
        script: "default"
      }),
    onSuccess: async () => {
      setCallModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["advisor-lead-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["advisor-leads"] });
    }
  });
  const startSmsMutation = useMutation({
    mutationFn: async () => api.startSmsInterview({ leadId: id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["advisor-lead-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["advisor-leads"] });
    }
  });
  const sendSmsMutation = useMutation({
    mutationFn: async () =>
      api.sendSmsMessage({
        leadId: id,
        body: smsBody
      }),
    onSuccess: async () => {
      setSmsBody("");
      await queryClient.invalidateQueries({ queryKey: ["advisor-lead-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["advisor-leads"] });
    }
  });

  const lead = detailQuery.data ?? null;

  React.useEffect(() => {
    if (!lead) return;
    setStatus(lead.status);
    setOwner(lead.owner ?? "");
    setNotes(lead.notes ?? "");
    setLastContactedAt(lead.lastContactedAt ? lead.lastContactedAt.slice(0, 16) : "");
    setToPhone(lead.candidate.phone ?? "");
  }, [lead]);

  const topTraits = useMemo(() => {
    if (!lead?.scorecard) return [];
    return [...lead.scorecard.perTrait].sort((a, b) => b.score0to5 - a.score0to5).slice(0, 3);
  }, [lead?.scorecard]);

  const groupedTraits = useMemo(() => {
    if (!lead?.scorecard) return [];
    const bucketOrder = ["CRITICAL", "VERY_IMPORTANT", "IMPORTANT", "NICE_TO_HAVE"];
    return bucketOrder
      .map((bucket) => ({
        bucket,
        items: lead.scorecard!.perTrait.filter((item) => item.bucket === bucket)
      }))
      .filter((group) => group.items.length > 0);
  }, [lead?.scorecard]);

  const selectedSessionRecord = useMemo(
    () => (lead?.selectedSession ? lead.sessions.find((session) => session.id === lead.selectedSession?.id) : null),
    [lead]
  );

  const selectedSmsSession = useMemo(() => selectedSessionRecord?.smsSessions?.[0] ?? null, [selectedSessionRecord]);

  const copySummary = async () => {
    if (!lead) return;

    const lines = [
      `Candidate: ${formatCandidateName(lead.candidate)}`,
      `Program: ${lead.program?.name ?? "-"}`,
      `Status: ${lead.status}`,
      `Overall Score: ${lead.scorecard ? lead.scorecard.overallScore.toFixed(2) : "-"}`,
      "Top Traits:",
      ...topTraits.map((trait) => `- ${trait.traitName}: ${trait.score0to5.toFixed(2)} (${trait.bucket})`)
    ];

    await navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6">
        <Button className="mb-4 bg-slate-500" onClick={() => window.history.back()}>
          Back
        </Button>

        {!lead && detailQuery.isLoading && <p className="text-sm text-slate-500">Loading lead...</p>}
        {!lead && detailQuery.error && <p className="text-sm text-red-700">Failed to load lead detail.</p>}

        {lead && (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold">{formatCandidateName(lead.candidate)}</h1>
                  <p className="text-sm text-slate-600">{lead.program?.name ?? "No program"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setCallModalOpen(true)}>Call candidate</Button>
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as LeadStatus)}
                  >
                    {leadStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="mb-2 text-xl font-semibold">Summary</h2>
              <p className="text-sm text-slate-700">Overall score: {lead.scorecard ? lead.scorecard.overallScore.toFixed(2) : "-"}</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                {topTraits.map((trait) => (
                  <p key={trait.traitId}>
                    {trait.traitName}: {trait.score0to5.toFixed(2)} ({trait.bucket})
                  </p>
                ))}
                {topTraits.length === 0 && <p>No trait summary available.</p>}
              </div>
              <Button className="mt-3" onClick={copySummary}>
                Copy summary
              </Button>
            </Card>

            <Card>
              <h2 className="mb-2 text-xl font-semibold">Sessions</h2>
              <div className="flex flex-wrap gap-2">
                {lead.sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-sm ${lead.selectedSession?.id === session.id ? "border-slate-900 bg-slate-100" : "border-slate-300"}`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    {session.mode} ({session.channel}) | {new Date(session.startedAt).toLocaleDateString()}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                {lead.sessions.flatMap((session) =>
                  session.callSessions.map((call) => (
                    <p key={call.id}>
                      Call {call.id.slice(0, 6)}: {call.status}
                      {call.failureReason ? ` (${call.failureReason})` : ""}
                    </p>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <h2 className="mb-2 text-xl font-semibold">Transcript</h2>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                {(lead.selectedSession?.transcript ?? []).map((turn) => (
                  <div key={turn.id} className="rounded bg-slate-50 p-2 text-sm">
                    <span className="font-semibold capitalize">{turn.speaker}:</span> {turn.text}
                  </div>
                ))}
                {(lead.selectedSession?.transcript ?? []).length === 0 && <p className="text-sm text-slate-500">No transcript captured.</p>}
              </div>
            </Card>

            <Card>
              <h2 className="mb-2 text-xl font-semibold">SMS</h2>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button onClick={() => startSmsMutation.mutate()} disabled={startSmsMutation.isPending || !lead.candidate.phone}>
                  {startSmsMutation.isPending ? "Starting..." : "Start SMS interview"}
                </Button>
                <p className="text-sm text-slate-600">
                  Opt-out status: {selectedSmsSession?.status === "OPTED_OUT" ? "Opted out" : "Active"}
                </p>
              </div>
              {!lead.candidate.phone && <p className="mb-2 text-sm text-red-700">Candidate phone is required to start SMS interview.</p>}
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                {(selectedSmsSession?.messages ?? []).map((message) => (
                  <div key={message.id} className="rounded bg-slate-50 p-2 text-sm">
                    <p className="font-semibold">{message.direction === "INBOUND" ? "Candidate" : "Advisor/Assistant"}</p>
                    <p>{message.body}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(message.createdAt).toLocaleString()}
                      {message.deliveryStatus ? ` • ${message.deliveryStatus}` : ""}
                    </p>
                  </div>
                ))}
                {(selectedSmsSession?.messages ?? []).length === 0 && <p className="text-sm text-slate-500">No SMS messages yet.</p>}
              </div>

              <div className="mt-3">
                <textarea
                  className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Send follow-up SMS"
                  value={smsBody}
                  onChange={(event) => setSmsBody(event.target.value)}
                  disabled={sendSmsMutation.isPending || selectedSmsSession?.status === "OPTED_OUT"}
                />
                <Button
                  className="mt-2"
                  onClick={() => sendSmsMutation.mutate()}
                  disabled={
                    sendSmsMutation.isPending ||
                    smsBody.trim().length === 0 ||
                    !lead.candidate.phone ||
                    selectedSmsSession?.status === "OPTED_OUT"
                  }
                >
                  {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
                </Button>
                {selectedSmsSession?.status === "OPTED_OUT" && (
                  <p className="mt-2 text-sm text-red-700">Candidate opted out. Outbound SMS is blocked until they reply START.</p>
                )}
                {startSmsMutation.error && <p className="mt-2 text-sm text-red-700">Failed to start SMS interview.</p>}
                {sendSmsMutation.error && (
                  <p className="mt-2 text-sm text-red-700">{(sendSmsMutation.error as Error).message || "Failed to send SMS."}</p>
                )}
              </div>
            </Card>

            {callModalOpen && (
              <Card>
                <h2 className="mb-2 text-xl font-semibold">Start Outbound Call</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="To phone"
                    value={toPhone}
                    onChange={(event) => setToPhone(event.target.value)}
                  />
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="From phone (optional)"
                    value={fromPhone}
                    onChange={(event) => setFromPhone(event.target.value)}
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => startCallMutation.mutate()} disabled={startCallMutation.isPending || toPhone.trim().length < 7}>
                    {startCallMutation.isPending ? "Starting..." : "Start call"}
                  </Button>
                  <Button className="bg-slate-500" onClick={() => setCallModalOpen(false)}>
                    Cancel
                  </Button>
                </div>
                {startCallMutation.error && <p className="mt-2 text-sm text-red-700">Failed to start call.</p>}
              </Card>
            )}

            <Card>
              <h2 className="mb-2 text-xl font-semibold">Trait Breakdown</h2>
              <div className="space-y-3">
                {groupedTraits.map((group) => (
                  <div key={group.bucket} className="rounded-md border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-semibold">{group.bucket.replaceAll("_", " ")}</p>
                    <div className="space-y-1 text-sm">
                      {group.items.map((item) => (
                        <p key={item.traitId}>
                          {item.traitName}: {item.score0to5.toFixed(2)} (confidence {confidenceLabel(item.confidence)})
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                {groupedTraits.length === 0 && <p className="text-sm text-slate-500">No scorecard breakdown available.</p>}
              </div>
            </Card>

            <Card>
              <h2 className="mb-2 text-xl font-semibold">Notes & Ownership</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Owner"
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                />
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  type="datetime-local"
                  value={lastContactedAt}
                  onChange={(event) => setLastContactedAt(event.target.value)}
                />
              </div>
              <textarea
                className="mt-3 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <Button className="mt-3" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                Save
              </Button>
              {saveMutation.error && <p className="mt-2 text-sm text-red-700">Failed to save lead updates.</p>}
            </Card>
          </div>
        )}
      </main>
    </AppShell>
  );
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/leads" replace />} />
      <Route path="/leads" element={<LeadQueuePage />} />
      <Route path="/leads/:id" element={<LeadDetailPage />} />
      <Route path="*" element={<Navigate to="/leads" replace />} />
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

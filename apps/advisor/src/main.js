import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { AppShell, Button, Card } from "@pmm/ui";
import { createApiClient } from "@pmm/api-client";
import "./styles.css";
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000" });
const queryClient = new QueryClient();
const leadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "APPLIED", "DISQUALIFIED"];
const terminalCallStatuses = new Set(["COMPLETED", "FAILED", "NO_ANSWER", "BUSY", "CANCELED"]);
const formatCandidateName = (candidate) => [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") || "Unknown";
const confidenceLabel = (value) => {
    if (value === null)
        return "-";
    if (value >= 0.75)
        return "High";
    if (value >= 0.5)
        return "Medium";
    return "Low";
};
const LeadQueuePage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const status = searchParams.get("status") ?? "";
    const programId = searchParams.get("programId") ?? "";
    const mode = searchParams.get("mode") ?? "";
    const q = searchParams.get("q") ?? "";
    const leadsQuery = useQuery({
        queryKey: ["advisor-leads", status, programId, mode, q],
        queryFn: async () => {
            const response = await api.getAdvisorLeads({
                status: (status || undefined),
                programId: programId || undefined,
                mode: (mode || undefined),
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
    const setFilter = (key, value) => {
        const next = new URLSearchParams(searchParams);
        if (value)
            next.set(key, value);
        else
            next.delete(key);
        setSearchParams(next);
    };
    return (_jsx(AppShell, { children: _jsxs("main", { className: "mx-auto max-w-6xl p-6", children: [_jsx("h1", { className: "mb-4 text-3xl font-bold", children: "Lead Queue" }), _jsxs(Card, { children: [_jsxs("div", { className: "mb-4 grid gap-3 md:grid-cols-4", children: [_jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Search name, email, phone", value: q, onChange: (event) => setFilter("q", event.target.value) }), _jsxs("select", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", value: status, onChange: (event) => setFilter("status", event.target.value), children: [_jsx("option", { value: "", children: "All statuses" }), leadStatuses.map((item) => (_jsx("option", { value: item, children: item }, item)))] }), _jsxs("select", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", value: programId, onChange: (event) => setFilter("programId", event.target.value), children: [_jsx("option", { value: "", children: "All programs" }), (programsQuery.data ?? []).map((program) => (_jsx("option", { value: program.id, children: program.name }, program.id)))] }), _jsxs("select", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", value: mode, onChange: (event) => setFilter("mode", event.target.value), children: [_jsx("option", { value: "", children: "All modes" }), _jsx("option", { value: "voice", children: "voice" }), _jsx("option", { value: "chat", children: "chat" }), _jsx("option", { value: "quiz", children: "quiz" })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full border-collapse text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-left text-slate-600", children: [_jsx("th", { className: "px-2 py-2", children: "Candidate" }), _jsx("th", { className: "px-2 py-2", children: "Program" }), _jsx("th", { className: "px-2 py-2", children: "Status" }), _jsx("th", { className: "px-2 py-2", children: "Mode" }), _jsx("th", { className: "px-2 py-2", children: "Started" }), _jsx("th", { className: "px-2 py-2", children: "Completed" }), _jsx("th", { className: "px-2 py-2", children: "Score" }), _jsx("th", { className: "px-2 py-2", children: "Confidence" })] }) }), _jsx("tbody", { children: (leadsQuery.data ?? []).map((lead) => (_jsxs("tr", { className: "cursor-pointer border-b border-slate-100 hover:bg-slate-50", onClick: () => navigate(`/leads/${lead.id}`), children: [_jsx("td", { className: "px-2 py-2", children: formatCandidateName(lead.candidate) }), _jsx("td", { className: "px-2 py-2", children: lead.program?.name ?? "-" }), _jsx("td", { className: "px-2 py-2", children: lead.status }), _jsx("td", { className: "px-2 py-2", children: lead.latestSession ? `${lead.latestSession.mode} (${lead.latestSession.channel})` : "-" }), _jsx("td", { className: "px-2 py-2", children: lead.latestSession?.startedAt ? new Date(lead.latestSession.startedAt).toLocaleString() : "-" }), _jsx("td", { className: "px-2 py-2", children: lead.latestSession?.endedAt ? new Date(lead.latestSession.endedAt).toLocaleString() : "-" }), _jsx("td", { className: "px-2 py-2", children: lead.scoreSummary ? lead.scoreSummary.overallScore.toFixed(2) : "-" }), _jsx("td", { className: "px-2 py-2", children: confidenceLabel(lead.scoreSummary?.confidence ?? null) })] }, lead.id))) })] }) }), !leadsQuery.isLoading && (leadsQuery.data ?? []).length === 0 && (_jsx("p", { className: "mt-3 text-sm text-slate-600", children: "No results. Try clearing filters or broadening your search." })), leadsQuery.isLoading && _jsx("p", { className: "mt-3 text-sm text-slate-500", children: "Loading leads..." }), leadsQuery.error && _jsx("p", { className: "mt-3 text-sm text-red-700", children: "Failed to load leads." })] })] }) }));
};
const LeadDetailPage = () => {
    const { id = "" } = useParams();
    const [selectedSessionId, setSelectedSessionId] = useState(undefined);
    const [notes, setNotes] = useState("");
    const [owner, setOwner] = useState("");
    const [status, setStatus] = useState("NEW");
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
            if (!latestCall)
                return false;
            return terminalCallStatuses.has(latestCall.status) ? false : 5000;
        }
    });
    const saveMutation = useMutation({
        mutationFn: async () => api.updateAdvisorLead(id, {
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
        mutationFn: async () => api.createPhoneCall({
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
        mutationFn: async () => api.sendSmsMessage({
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
        if (!lead)
            return;
        setStatus(lead.status);
        setOwner(lead.owner ?? "");
        setNotes(lead.notes ?? "");
        setLastContactedAt(lead.lastContactedAt ? lead.lastContactedAt.slice(0, 16) : "");
        setToPhone(lead.candidate.phone ?? "");
    }, [lead]);
    const topTraits = useMemo(() => {
        if (!lead?.scorecard)
            return [];
        return [...lead.scorecard.perTrait].sort((a, b) => b.score0to5 - a.score0to5).slice(0, 3);
    }, [lead?.scorecard]);
    const groupedTraits = useMemo(() => {
        if (!lead?.scorecard)
            return [];
        const bucketOrder = ["CRITICAL", "VERY_IMPORTANT", "IMPORTANT", "NICE_TO_HAVE"];
        return bucketOrder
            .map((bucket) => ({
            bucket,
            items: lead.scorecard.perTrait.filter((item) => item.bucket === bucket)
        }))
            .filter((group) => group.items.length > 0);
    }, [lead?.scorecard]);
    const selectedSessionRecord = useMemo(() => (lead?.selectedSession ? lead.sessions.find((session) => session.id === lead.selectedSession?.id) : null), [lead]);
    const selectedSmsSession = useMemo(() => selectedSessionRecord?.smsSessions?.[0] ?? null, [selectedSessionRecord]);
    const copySummary = async () => {
        if (!lead)
            return;
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
    return (_jsx(AppShell, { children: _jsxs("main", { className: "mx-auto max-w-5xl p-6", children: [_jsx(Button, { className: "mb-4 bg-slate-500", onClick: () => window.history.back(), children: "Back" }), !lead && detailQuery.isLoading && _jsx("p", { className: "text-sm text-slate-500", children: "Loading lead..." }), !lead && detailQuery.error && _jsx("p", { className: "text-sm text-red-700", children: "Failed to load lead detail." }), lead && (_jsxs("div", { className: "space-y-4", children: [_jsx(Card, { children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: formatCandidateName(lead.candidate) }), _jsx("p", { className: "text-sm text-slate-600", children: lead.program?.name ?? "No program" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { onClick: () => setCallModalOpen(true), children: "Call candidate" }), _jsx("select", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", value: status, onChange: (event) => setStatus(event.target.value), children: leadStatuses.map((item) => (_jsx("option", { value: item, children: item }, item))) })] })] }) }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-2 text-xl font-semibold", children: "Summary" }), _jsxs("p", { className: "text-sm text-slate-700", children: ["Overall score: ", lead.scorecard ? lead.scorecard.overallScore.toFixed(2) : "-"] }), _jsxs("div", { className: "mt-2 space-y-1 text-sm text-slate-700", children: [topTraits.map((trait) => (_jsxs("p", { children: [trait.traitName, ": ", trait.score0to5.toFixed(2), " (", trait.bucket, ")"] }, trait.traitId))), topTraits.length === 0 && _jsx("p", { children: "No trait summary available." })] }), _jsx(Button, { className: "mt-3", onClick: copySummary, children: "Copy summary" })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-2 text-xl font-semibold", children: "Sessions" }), _jsx("div", { className: "flex flex-wrap gap-2", children: lead.sessions.map((session) => (_jsxs("button", { type: "button", className: `rounded-md border px-3 py-2 text-sm ${lead.selectedSession?.id === session.id ? "border-slate-900 bg-slate-100" : "border-slate-300"}`, onClick: () => setSelectedSessionId(session.id), children: [session.mode, " (", session.channel, ") | ", new Date(session.startedAt).toLocaleDateString()] }, session.id))) }), _jsx("div", { className: "mt-3 space-y-1 text-sm text-slate-700", children: lead.sessions.flatMap((session) => session.callSessions.map((call) => (_jsxs("p", { children: ["Call ", call.id.slice(0, 6), ": ", call.status, call.failureReason ? ` (${call.failureReason})` : ""] }, call.id)))) })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-2 text-xl font-semibold", children: "Transcript" }), _jsxs("div", { className: "max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3", children: [(lead.selectedSession?.transcript ?? []).map((turn) => (_jsxs("div", { className: "rounded bg-slate-50 p-2 text-sm", children: [_jsxs("span", { className: "font-semibold capitalize", children: [turn.speaker, ":"] }), " ", turn.text] }, turn.id))), (lead.selectedSession?.transcript ?? []).length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "No transcript captured." })] })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-2 text-xl font-semibold", children: "SMS" }), _jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [_jsx(Button, { onClick: () => startSmsMutation.mutate(), disabled: startSmsMutation.isPending || !lead.candidate.phone, children: startSmsMutation.isPending ? "Starting..." : "Start SMS interview" }), _jsxs("p", { className: "text-sm text-slate-600", children: ["Opt-out status: ", selectedSmsSession?.status === "OPTED_OUT" ? "Opted out" : "Active"] })] }), !lead.candidate.phone && _jsx("p", { className: "mb-2 text-sm text-red-700", children: "Candidate phone is required to start SMS interview." }), _jsxs("div", { className: "max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3", children: [(selectedSmsSession?.messages ?? []).map((message) => (_jsxs("div", { className: "rounded bg-slate-50 p-2 text-sm", children: [_jsx("p", { className: "font-semibold", children: message.direction === "INBOUND" ? "Candidate" : "Advisor/Assistant" }), _jsx("p", { children: message.body }), _jsxs("p", { className: "text-xs text-slate-500", children: [new Date(message.createdAt).toLocaleString(), message.deliveryStatus ? ` • ${message.deliveryStatus}` : ""] })] }, message.id))), (selectedSmsSession?.messages ?? []).length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "No SMS messages yet." })] }), _jsxs("div", { className: "mt-3", children: [_jsx("textarea", { className: "min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Send follow-up SMS", value: smsBody, onChange: (event) => setSmsBody(event.target.value), disabled: sendSmsMutation.isPending || selectedSmsSession?.status === "OPTED_OUT" }), _jsx(Button, { className: "mt-2", onClick: () => sendSmsMutation.mutate(), disabled: sendSmsMutation.isPending ||
                                                smsBody.trim().length === 0 ||
                                                !lead.candidate.phone ||
                                                selectedSmsSession?.status === "OPTED_OUT", children: sendSmsMutation.isPending ? "Sending..." : "Send SMS" }), selectedSmsSession?.status === "OPTED_OUT" && (_jsx("p", { className: "mt-2 text-sm text-red-700", children: "Candidate opted out. Outbound SMS is blocked until they reply START." })), startSmsMutation.error && _jsx("p", { className: "mt-2 text-sm text-red-700", children: "Failed to start SMS interview." }), sendSmsMutation.error && (_jsx("p", { className: "mt-2 text-sm text-red-700", children: sendSmsMutation.error.message || "Failed to send SMS." }))] })] }), callModalOpen && (_jsxs(Card, { children: [_jsx("h2", { className: "mb-2 text-xl font-semibold", children: "Start Outbound Call" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "To phone", value: toPhone, onChange: (event) => setToPhone(event.target.value) }), _jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "From phone (optional)", value: fromPhone, onChange: (event) => setFromPhone(event.target.value) })] }), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsx(Button, { onClick: () => startCallMutation.mutate(), disabled: startCallMutation.isPending || toPhone.trim().length < 7, children: startCallMutation.isPending ? "Starting..." : "Start call" }), _jsx(Button, { className: "bg-slate-500", onClick: () => setCallModalOpen(false), children: "Cancel" })] }), startCallMutation.error && _jsx("p", { className: "mt-2 text-sm text-red-700", children: "Failed to start call." })] })), _jsxs(Card, { children: [_jsx("h2", { className: "mb-2 text-xl font-semibold", children: "Trait Breakdown" }), _jsxs("div", { className: "space-y-3", children: [groupedTraits.map((group) => (_jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsx("p", { className: "mb-2 text-sm font-semibold", children: group.bucket.replaceAll("_", " ") }), _jsx("div", { className: "space-y-1 text-sm", children: group.items.map((item) => (_jsxs("p", { children: [item.traitName, ": ", item.score0to5.toFixed(2), " (confidence ", confidenceLabel(item.confidence), ")"] }, item.traitId))) })] }, group.bucket))), groupedTraits.length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "No scorecard breakdown available." })] })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-2 text-xl font-semibold", children: "Notes & Ownership" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Owner", value: owner, onChange: (event) => setOwner(event.target.value) }), _jsx("input", { className: "rounded-md border border-slate-300 px-3 py-2 text-sm", type: "datetime-local", value: lastContactedAt, onChange: (event) => setLastContactedAt(event.target.value) })] }), _jsx("textarea", { className: "mt-3 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Notes", value: notes, onChange: (event) => setNotes(event.target.value) }), _jsx(Button, { className: "mt-3", onClick: () => saveMutation.mutate(), disabled: saveMutation.isPending, children: "Save" }), saveMutation.error && _jsx("p", { className: "mt-2 text-sm text-red-700", children: "Failed to save lead updates." })] })] }))] }) }));
};
const App = () => (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/leads", replace: true }) }), _jsx(Route, { path: "/leads", element: _jsx(LeadQueuePage, {}) }), _jsx(Route, { path: "/leads/:id", element: _jsx(LeadDetailPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/leads", replace: true }) })] }) }));
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(App, {}) }) }));

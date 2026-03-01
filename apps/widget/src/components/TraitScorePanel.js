import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
const confidenceClass = {
    low: "quiz-chip confidence-low",
    medium: "quiz-chip confidence-medium",
    high: "quiz-chip confidence-high"
};
const statusClass = {
    unanswered: "status-chip status-unanswered",
    active: "status-chip status-active",
    complete: "status-chip status-complete"
};
const SegmentedScore = ({ score }) => {
    const rounded = score === null ? 0 : Math.max(1, Math.min(5, Math.round(score)));
    return (_jsx("div", { className: "flex gap-1", "aria-label": "trait-score-segments", children: [1, 2, 3, 4, 5].map((segment) => (_jsx("span", { className: `h-2.5 w-5 rounded-full ${segment <= rounded ? "bg-slate-900" : "bg-slate-200"}`, "aria-hidden": "true" }, segment))) }));
};
export const TraitScorePanel = ({ traits, activeTraitId, done = false, onActiveTraitAction, actionPending = false }) => {
    const [expandedTraitIds, setExpandedTraitIds] = useState({});
    const ordered = useMemo(() => traits, [traits]);
    return (_jsxs("section", { className: "rounded-xl border border-slate-200 bg-white/80 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900", children: "Trait scoring" }), _jsx("span", { className: "live-chip text-xs", children: "Live" })] }), _jsxs("div", { className: "max-h-72 space-y-2 overflow-y-auto pr-1", children: [ordered.map((trait) => {
                        const isActive = trait.traitId === activeTraitId || trait.status === "active";
                        const expanded = expandedTraitIds[trait.traitId] ?? false;
                        const evidence = trait.evidence.slice(0, expanded ? 10 : 2);
                        return (_jsxs("article", { className: `rounded-md border p-2 ${isActive ? "trait-row-active" : "border-slate-200 bg-white"}`, "data-testid": `trait-row-${trait.traitId}`, children: [_jsxs("div", { className: "mb-1 flex items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm font-medium text-slate-900", children: trait.traitName }), _jsx("span", { className: `rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass[trait.status]}`, children: trait.status === "active" ? "in-progress" : trait.status })] }), isActive && onActiveTraitAction && !done && (_jsxs("div", { className: "mb-2 flex flex-wrap gap-2", children: [_jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50", onClick: () => onActiveTraitAction("continue"), disabled: actionPending, children: "Continue" }), _jsx("button", { type: "button", className: "rounded-md border px-2 py-1 text-[11px] font-semibold quiz-action-primary disabled:cursor-not-allowed disabled:opacity-50", onClick: () => onActiveTraitAction("deepen"), disabled: actionPending, children: "Go deeper" })] })), _jsxs("div", { className: "mb-1 flex items-center justify-between gap-2", children: [_jsx(SegmentedScore, { score: trait.score_1_to_5 }), trait.confidence && (_jsx("span", { className: `rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${confidenceClass[trait.confidence]}`, children: trait.confidence }))] }), evidence.length > 0 && (_jsx("ul", { className: "space-y-0.5 text-xs text-slate-700", children: evidence.map((entry, index) => (_jsx("li", { className: "truncate", children: entry }, `${trait.traitId}-evidence-${index}`))) })), _jsxs("div", { className: "mt-1 flex gap-3 text-xs", children: [trait.evidence.length > 2 && (_jsx("button", { type: "button", className: "text-slate-600 underline", onClick: () => setExpandedTraitIds((prev) => ({ ...prev, [trait.traitId]: !expanded })), children: expanded ? "Collapse evidence" : "Expand evidence" })), trait.rationale && (_jsx("button", { type: "button", className: "why-match-link underline", onClick: () => setExpandedTraitIds((prev) => ({ ...prev, [trait.traitId]: !expanded })), children: "Why this score?" }))] }), expanded && trait.rationale && _jsx("p", { className: "mt-1 text-xs text-slate-700", children: trait.rationale })] }, trait.traitId));
                    }), ordered.length === 0 && _jsx("p", { className: "text-xs text-slate-500", children: "No trait scoring data yet." })] }), done && _jsx("p", { className: "mt-2 text-xs text-slate-500", children: "Finalized trait breakdown." })] }));
};

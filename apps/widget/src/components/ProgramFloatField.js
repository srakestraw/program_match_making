import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const confidenceLabel = (value) => {
    if (!Number.isFinite(value))
        return "Low";
    if ((value ?? 0) >= 0.75)
        return "High";
    if ((value ?? 0) >= 0.5)
        return "Medium";
    return "Low";
};
export const ProgramFloatField = ({ programs, selectedProgramId, done = false }) => {
    const [expandedProgramId, setExpandedProgramId] = useState(null);
    const ranked = useMemo(() => [...programs].sort((a, b) => b.fitScore_0_to_100 - a.fitScore_0_to_100).slice(0, 3), [programs]);
    const previousRankRef = useRef({});
    const [rankDelta, setRankDelta] = useState({});
    useEffect(() => {
        const nextMap = {};
        const deltaMap = {};
        ranked.forEach((program, index) => {
            nextMap[program.programId] = index;
            const previous = previousRankRef.current[program.programId];
            if (typeof previous === "number") {
                deltaMap[program.programId] = previous - index;
            }
            else {
                deltaMap[program.programId] = 0;
            }
        });
        previousRankRef.current = nextMap;
        setRankDelta(deltaMap);
    }, [ranked]);
    return (_jsxs("section", { className: "rounded-xl border border-slate-200 bg-white/80 p-3", "data-testid": "program-float-field", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900", children: done ? "Final rankings" : "Live program rankings" }), _jsx("span", { className: "text-xs text-slate-500", children: "Top 3" })] }), _jsxs("div", { className: "space-y-2", children: [ranked.map((program, index) => {
                        const expanded = expandedProgramId === program.programId;
                        const isSelected = selectedProgramId === program.programId;
                        const confidencePct = Math.round((program.confidence_0_to_1 ?? 0) * 100);
                        const delta = program.deltaFromLast_0_to_100 ?? 0;
                        const positiveDelta = delta > 0;
                        return (_jsxs("article", { className: `rounded-md border p-2 transition-all duration-300 ${isSelected ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-white"}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-slate-900", children: [index + 1, ". ", program.programName] }), _jsxs("p", { className: "text-xs text-slate-600", children: ["Score: ", program.fitScore_0_to_100.toFixed(1), "%"] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700", children: [confidenceLabel(program.confidence_0_to_1), " ", confidencePct, "%"] }), rankDelta[program.programId] !== 0 && (_jsxs("p", { className: `mt-1 text-[10px] font-semibold ${(rankDelta[program.programId] ?? 0) > 0 ? "text-emerald-700" : "text-rose-700"}`, children: [(rankDelta[program.programId] ?? 0) > 0 ? "▲" : "▼", " ", Math.abs(rankDelta[program.programId] ?? 0), " rank"] })), _jsxs("p", { className: `mt-1 text-xs font-medium ${positiveDelta ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-slate-500"}`, children: ["Delta ", positiveDelta ? "+" : "", delta.toFixed(1)] })] })] }), _jsx("button", { type: "button", className: "mt-1 text-xs text-slate-700 underline", onClick: () => setExpandedProgramId((prev) => (prev === program.programId ? null : program.programId)), children: expanded ? "Hide explainability" : "Why this match?" }), expanded && (_jsxs("div", { className: "mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-900", children: "Top contributing traits" }), _jsx("ul", { className: "mt-1 space-y-0.5", children: (program.explainability?.topContributors ?? []).slice(0, 3).map((item) => (_jsxs("li", { children: [(item.publicLabel ?? item.traitName), " (", Math.round(item.contribution * 100), "%)"] }, `${program.programId}-top-${item.traitId}`))) })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-900", children: "Weak or missing traits" }), _jsx("ul", { className: "mt-1 space-y-0.5", children: (program.explainability?.gaps ?? []).slice(0, 3).map((item) => (_jsxs("li", { children: [item.traitName, " (", item.reason.replace("_", " "), ")"] }, `${program.programId}-gap-${item.traitId}`))) })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-900", children: "What increases confidence" }), _jsx("ul", { className: "mt-1 space-y-0.5", children: (program.explainability?.suggestions ?? []).slice(0, 2).map((item) => (_jsxs("li", { children: [item.traitName, ": ", item.reason] }, `${program.programId}-suggest-${item.traitId}`))) })] })] }))] }, program.programId));
                    }), ranked.length === 0 && _jsx("p", { className: "text-xs text-slate-500", children: "Ranking updates will appear once responses arrive." })] })] }));
};

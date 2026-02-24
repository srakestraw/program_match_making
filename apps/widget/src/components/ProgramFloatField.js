import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { computeProgramBubbleLayout } from "../lib/programFloatLayout";
export const ProgramFloatField = ({ programs, selectedProgramId, done = false }) => {
    const [pinnedProgramId, setPinnedProgramId] = useState(null);
    const [frozenLayout, setFrozenLayout] = useState(null);
    const layout = useMemo(() => computeProgramBubbleLayout({ programs, selectedProgramId: selectedProgramId ?? null }), [programs, selectedProgramId]);
    useEffect(() => {
        if (done && !frozenLayout) {
            setFrozenLayout(layout);
            return;
        }
        if (!done && frozenLayout) {
            setFrozenLayout(null);
        }
    }, [done, frozenLayout, layout]);
    const programsById = useMemo(() => new Map(programs.map((program) => [program.programId, program])), [programs]);
    const ranked = useMemo(() => [...programs].sort((a, b) => b.fitScore_0_to_100 - a.fitScore_0_to_100), [programs]);
    return (_jsxs("section", { className: "rounded-xl border border-slate-200 bg-white/80 p-3", "data-testid": "program-float-field", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900", children: "Program fit radar" }), _jsx("span", { className: "text-xs text-slate-500", children: "Click to pin" })] }), _jsx("div", { className: "relative h-[320px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100", children: (frozenLayout ?? layout).map((bubble) => {
                    const program = programsById.get(bubble.programId);
                    if (!program)
                        return null;
                    const isSelected = selectedProgramId === bubble.programId;
                    const isPinned = pinnedProgramId === bubble.programId;
                    return (_jsxs("button", { type: "button", className: `absolute rounded-full border text-center shadow-sm transition-all duration-700 ease-out ${isSelected ? "border-blue-500 bg-blue-100/80" : "border-slate-300 bg-white/85"} ${isPinned ? "ring-2 ring-blue-400" : ""}`, style: {
                            width: `${bubble.sizePx}px`,
                            height: `${bubble.sizePx}px`,
                            transform: `translate(-50%, -50%) translate(${bubble.xPct}%, ${bubble.yPct}%)`,
                            opacity: bubble.opacity,
                            zIndex: isPinned ? 20 : isSelected ? 15 : 10
                        }, onClick: () => setPinnedProgramId((prev) => (prev === bubble.programId ? null : bubble.programId)), "data-testid": `program-bubble-${bubble.programId}`, children: [_jsx("span", { className: "block px-2 pt-3 text-[11px] font-semibold leading-tight text-slate-900", children: program.programName }), _jsxs("span", { className: "block px-2 text-[10px] text-slate-600", children: [Math.round(program.fitScore_0_to_100), "%"] }), _jsx("span", { className: "mt-1 block px-2 text-[9px] text-slate-500", children: program.topTraits.slice(0, 2).map((item) => item.traitName).join(" · ") }), (isPinned || isSelected) && (_jsx("span", { className: "pointer-events-none absolute -bottom-24 left-1/2 w-44 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-[10px] text-slate-700 shadow-md", children: program.topTraits.slice(0, 3).map((item) => (_jsxs("span", { className: "block", children: [item.traitName, ": ", item.delta > 0 ? "+" : "", item.delta.toFixed(2)] }, `${bubble.programId}-${item.traitName}`))) }))] }, bubble.programId));
                }) }), done && (_jsxs("div", { className: "mt-3 rounded-md border border-slate-200 bg-white p-2", children: [_jsx("p", { className: "mb-1 text-xs font-semibold text-slate-900", children: "Final ranking" }), _jsx("ol", { className: "space-y-1 text-xs text-slate-700", children: ranked.map((item, index) => (_jsxs("li", { children: [index + 1, ". ", item.programName, " - ", item.fitScore_0_to_100.toFixed(1), "%"] }, item.programId))) })] }))] }));
};

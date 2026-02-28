import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function TraitSetSection({ sets, traitsById, alreadyAddedTraitIds, selectedTraitIds, previewSetId, onPreviewSet, onSelectSet, isLoading, activeCategory, hasSearch }) {
    const [isExpanded, setIsExpanded] = useState(false);
    if (isLoading) {
        return (_jsxs("section", { className: "rounded-md border border-slate-200/70 bg-white/80 p-3", children: [_jsx("div", { className: "mb-2 h-4 w-52 animate-pulse rounded bg-slate-200/70" }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "h-16 animate-pulse rounded bg-slate-100" }), _jsx("div", { className: "h-16 animate-pulse rounded bg-slate-100" })] })] }));
    }
    if (sets.length === 0)
        return null;
    const categoryLabel = activeCategory === "ALL" ? "All categories" : activeCategory;
    return (_jsxs("section", { className: "rounded-md border border-slate-200/70 bg-white/80 p-3", children: [_jsxs("button", { type: "button", onClick: () => setIsExpanded((prev) => !prev), className: "flex w-full items-center gap-1 text-left text-sm font-semibold text-slate-800 hover:text-slate-900", "aria-expanded": isExpanded, "aria-label": isExpanded ? "Collapse suggested sets" : "Expand suggested sets", children: ["Suggested sets", _jsx("span", { className: "text-slate-500", "aria-hidden": true, children: isExpanded ? "\u25BC" : "\u25B6" })] }), hasSearch && (_jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["Based on ", categoryLabel, " and your search"] })), isExpanded && (_jsx("div", { className: "mt-3 grid gap-2 lg:grid-cols-2", children: sets.map((set) => {
                    const isPreviewOpen = previewSetId === set.id;
                    const addableCount = set.traitIds.filter((id) => !alreadyAddedTraitIds.has(id)).length;
                    return (_jsxs("div", { "data-set-id": set.id, className: "rounded-md border border-slate-200/80 bg-white p-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-800", children: set.name }), _jsxs("p", { className: "text-xs text-slate-500", children: [set.traitIds.length, " traits"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => onPreviewSet(set.id), "aria-label": `Preview set ${set.name}`, className: "text-xs font-medium text-slate-600 underline hover:text-slate-900", children: "Preview" }), _jsxs("button", { type: "button", onClick: () => onSelectSet(set.id), "aria-label": `Add all ${addableCount} traits from set ${set.name}`, className: "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50", children: ["Add all (", addableCount, ")"] })] })] }), isPreviewOpen && (_jsx("ul", { className: "mt-3 space-y-1.5 border-t border-slate-200/80 pt-2", children: set.traitIds.map((traitId) => {
                                    const trait = traitsById.get(traitId);
                                    if (!trait)
                                        return null;
                                    const isAdded = alreadyAddedTraitIds.has(trait.id);
                                    const isSelected = selectedTraitIds.has(trait.id);
                                    return (_jsxs("li", { className: "rounded-md bg-slate-50 px-2 py-1.5 text-xs", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "font-medium text-slate-800", children: trait.name }), isAdded ? (_jsx("span", { className: "rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600", children: "On board" })) : isSelected ? (_jsx("span", { className: "rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600", children: "Selected" })) : (_jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600", children: "Available" }))] }), trait.definition && _jsx("p", { className: "mt-0.5 text-slate-500", children: trait.definition })] }, trait.id));
                                }) }))] }, set.id));
                }) }))] }));
}

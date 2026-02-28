import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { traitCategories } from "@pmm/domain";
const categoryCounts = (traits) => {
    const counts = {};
    for (const t of traits) {
        counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return counts;
};
export function TraitCategoryRail({ traits, activeCategory, onCategoryChange, filters, onFilterChange, unassignedCount }) {
    const counts = React.useMemo(() => categoryCounts(traits), [traits]);
    return (_jsxs("div", { className: "flex h-full flex-col border-r border-slate-200 bg-slate-50/50", children: [_jsxs("div", { className: "p-3", children: [_jsx("h4", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Category" }), _jsxs("nav", { className: "space-y-0.5", "aria-label": "Trait categories", children: [_jsxs("button", { type: "button", onClick: () => onCategoryChange("ALL"), className: `w-full rounded-md px-2 py-1.5 text-left text-sm ${activeCategory === "ALL" ? "bg-slate-200 font-medium text-slate-800" : "text-slate-700 hover:bg-slate-100"}`, children: ["All (", traits.length, ")"] }), traitCategories.map((cat) => (_jsxs("button", { type: "button", onClick: () => onCategoryChange(cat), className: `w-full rounded-md px-2 py-1.5 text-left text-sm ${activeCategory === cat ? "bg-slate-200 font-medium text-slate-800" : "text-slate-700 hover:bg-slate-100"}`, children: [cat, " (", counts[cat] ?? 0, ")"] }, cat)))] })] }), _jsxs("div", { className: "mt-4 border-t border-slate-200 p-3", children: [_jsx("h4", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Filters" }), _jsx("div", { className: "space-y-1.5", children: [
                            { key: "recommended", label: "Recommended for this program" },
                            { key: "popular", label: "Popular" },
                            { key: "unassigned", label: `Only unassigned (${unassignedCount})` }
                        ].map(({ key, label }) => (_jsxs("label", { className: "flex cursor-pointer items-center gap-2 text-sm text-slate-700", children: [_jsx("input", { type: "checkbox", checked: filters[key], onChange: (e) => onFilterChange(key, e.target.checked), className: "h-3.5 w-3.5 rounded border-slate-300 text-slate-700 focus:ring-slate-500" }), label] }, key))) })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function TraitResultsList({ traits, activeCategory, totalTraitsInActiveCategory, searchQuery, alreadyAddedTraitIds, selectedTraitIds, onToggleTrait, isLoading }) {
    let emptyState = "No traits match your search.";
    if (!searchQuery.trim() && activeCategory !== "ALL" && totalTraitsInActiveCategory === 0) {
        emptyState = "No traits in this category yet.";
    }
    else if (!searchQuery.trim() && activeCategory === "ALL") {
        emptyState = "No traits in this category yet.";
    }
    return (_jsxs("section", { "aria-label": "Traits results", className: "min-h-0 rounded-md border border-slate-200/70 bg-white/80 p-3", children: [_jsx("h4", { className: "mb-2 text-sm font-semibold text-slate-800", children: "Traits" }), isLoading ? (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "h-14 animate-pulse rounded bg-slate-100" }), _jsx("div", { className: "h-14 animate-pulse rounded bg-slate-100" }), _jsx("div", { className: "h-14 animate-pulse rounded bg-slate-100" })] })) : traits.length === 0 ? (_jsx("p", { className: "py-4 text-sm text-slate-500", children: emptyState })) : (_jsx("ul", { className: "space-y-1.5", children: traits.map((trait) => {
                    const isOnBoard = alreadyAddedTraitIds.has(trait.id);
                    const isSelected = selectedTraitIds.has(trait.id);
                    const canSelect = !isOnBoard;
                    const handleRowClick = (e) => {
                        if (!canSelect)
                            return;
                        if (e.target.closest('input[type="checkbox"]'))
                            return;
                        e.preventDefault();
                        onToggleTrait(trait.id);
                    };
                    return (_jsxs("li", { role: "button", tabIndex: canSelect ? 0 : -1, onClick: handleRowClick, onKeyDown: (e) => {
                            if (!canSelect)
                                return;
                            if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                onToggleTrait(trait.id);
                            }
                        }, className: `flex cursor-default items-start gap-3 rounded-md border px-3 py-2 ${isOnBoard
                            ? "cursor-not-allowed border-slate-200/80 bg-slate-50/80 opacity-75"
                            : "cursor-pointer border-slate-200/80 bg-white hover:bg-slate-50/80"}`, "aria-disabled": isOnBoard, "aria-pressed": canSelect ? isSelected : undefined, children: [_jsx("input", { type: "checkbox", checked: isSelected, disabled: isOnBoard, onChange: () => canSelect && onToggleTrait(trait.id), onClick: (e) => e.stopPropagation(), "aria-label": isOnBoard ? `${trait.name} (on board)` : `${trait.name}${isSelected ? ", selected" : ""}`, className: "mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-slate-700 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "truncate text-sm font-medium text-slate-800", children: trait.name }), isOnBoard && (_jsx("span", { className: "rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600", children: "Added" })), _jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600", children: trait.status.replaceAll("_", " ") }), trait.status !== "ACTIVE" && (_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800", children: "Excluded from scoring" }))] }), _jsx("p", { className: "mt-0.5 line-clamp-1 text-xs text-slate-500", children: trait.definition ?? "No description" }), isOnBoard && _jsx("p", { className: "mt-0.5 text-[11px] text-slate-500", children: "Already on board" }), _jsx("span", { className: "mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600", children: trait.category })] })] }, trait.id));
                }) }))] }));
}

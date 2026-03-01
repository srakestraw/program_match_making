import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
/**
 * Secondary reference panel: "Used In Programs".
 * Used as a sticky right column on desktop and inside TraitProgramsAccordion on mobile.
 */
export function TraitProgramsPanel({ programs, loading, error, onManage, onProgramClick, embedded = false }) {
    const count = programs.length;
    const sorted = [...programs].sort((a, b) => a.programName.localeCompare(b.programName));
    const content = (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-700", children: "Used In Programs" }), _jsx("button", { type: "button", className: "text-xs font-medium text-slate-500 underline hover:text-slate-700", onClick: onManage, "aria-label": "Manage associated programs", children: "Manage" })] }), _jsx("p", { className: "mb-3 text-xs text-slate-500", children: count === 1 ? "1 program" : `${count} programs` }), loading && _jsx("p", { className: "text-sm text-slate-500", children: "Loading\u2026" }), error && _jsx("p", { className: "text-sm text-red-700", children: error }), !loading && !error && sorted.length === 0 && (_jsx("p", { className: "text-sm text-slate-600", children: "No associated programs yet." })), !loading && !error && sorted.length > 0 && (_jsx("ul", { className: "space-y-1.5", children: sorted.map((item, index) => (_jsxs("li", { className: "flex items-center justify-between gap-2 rounded border border-slate-200/80 bg-white px-2.5 py-1.5", children: [onProgramClick ? (_jsx("button", { type: "button", className: "min-w-0 flex-1 truncate text-left text-sm text-slate-600 underline hover:text-slate-800", onClick: () => onProgramClick(item.programId), children: item.programName })) : (_jsx("span", { className: "min-w-0 flex-1 truncate text-sm text-slate-700", children: item.programName })), _jsxs("span", { className: "shrink-0 text-xs text-slate-500", children: [item.bucket, " \u00B7 ", item.weight.toFixed(2)] })] }, `${item.programId}-${index}`))) }))] }));
    if (embedded) {
        return _jsx("div", { className: "pt-0", children: content });
    }
    return (_jsx("div", { className: "rounded-md border border-slate-200/80 bg-slate-50/40 p-3.5", children: content }));
}
/**
 * Collapsible "Used In Programs (N)" section for mobile/small screens.
 */
export function TraitProgramsAccordion({ programs, loading, error, onManage, onProgramClick, defaultExpanded = false, open: controlledOpen, onToggle }) {
    const [internalOpen, setInternalOpen] = React.useState(defaultExpanded);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (next) => {
        if (!isControlled)
            setInternalOpen(next);
        onToggle?.(next);
    };
    const count = programs.length;
    const label = `Used In Programs (${count})`;
    return (_jsxs("section", { className: "rounded-md border border-slate-200 bg-slate-50/50", children: [_jsxs("button", { type: "button", className: "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100/80", onClick: () => setOpen(!open), "aria-expanded": open, "aria-controls": "trait-programs-accordion-content", id: "trait-programs-accordion-heading", children: [_jsx("span", { children: label }), _jsx("span", { className: "shrink-0 text-slate-400", "aria-hidden": true, children: open ? "−" : "+" })] }), open && (_jsx("div", { id: "trait-programs-accordion-content", role: "region", "aria-labelledby": "trait-programs-accordion-heading", className: "border-t border-slate-200/80 p-4", children: _jsx(TraitProgramsPanel, { programs: programs, loading: loading, error: error, onManage: onManage, onProgramClick: onProgramClick, embedded: true }) }))] }));
}

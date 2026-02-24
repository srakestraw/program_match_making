import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const rows = [
    { key: "headline", label: "Headline", type: "headline" },
    { key: "cta", label: "CTA", type: "cta" },
    { key: "email_intro", label: "Email intro", type: "email_intro" },
    { key: "description", label: "Description", type: "description" }
];
export function GeneratedSamplesPanel({ samples, onPin, onReplacePreview }) {
    return (_jsxs("div", { className: "rounded-md border border-emerald-300 bg-emerald-50 p-3", children: [_jsx("h3", { className: "mb-2 text-sm font-semibold text-emerald-900", children: "AI Suggestions" }), _jsx("div", { className: "space-y-2", children: rows.map((row) => (_jsxs("div", { className: "rounded-md border border-emerald-200 bg-white p-2", children: [_jsx("p", { className: "text-[11px] font-medium uppercase tracking-wide text-slate-500", children: row.label }), _jsx("p", { className: "mb-2 text-sm text-slate-800", children: samples[row.key] }), _jsxs("div", { className: "flex gap-2 text-xs", children: [_jsx("button", { type: "button", className: "rounded border border-slate-300 px-2 py-1 hover:bg-slate-50", onClick: () => onPin(row.type, samples[row.key]), children: "Pin" }), _jsx("button", { type: "button", className: "rounded border border-slate-300 px-2 py-1 hover:bg-slate-50", onClick: () => void navigator.clipboard?.writeText(samples[row.key]), children: "Copy" }), _jsx("button", { type: "button", className: "rounded border border-slate-300 px-2 py-1 hover:bg-slate-50", onClick: () => onReplacePreview(row.type, samples[row.key]), children: "Replace Preview" })] })] }, row.key))) })] }));
}

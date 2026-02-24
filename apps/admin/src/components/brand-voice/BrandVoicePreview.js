import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function BrandVoicePreview({ title, samples }) {
    const rows = [
        { key: "headline", label: "Headline" },
        { key: "cta", label: "CTA" },
        { key: "email_intro", label: "Email intro" },
        { key: "description", label: "Description" }
    ];
    return (_jsxs("div", { className: "rounded-md border border-slate-200 bg-slate-50 p-3", children: [_jsx("h3", { className: "mb-2 text-sm font-semibold text-slate-800", children: title }), _jsx("div", { className: "space-y-2", children: rows.map((row) => (_jsxs("div", { className: "rounded-md border border-slate-200 bg-white p-2", children: [_jsx("p", { className: "text-[11px] font-medium uppercase tracking-wide text-slate-500", children: row.label }), _jsx("p", { className: "text-sm text-slate-800", children: samples[row.key] })] }, row.key))) })] }));
}

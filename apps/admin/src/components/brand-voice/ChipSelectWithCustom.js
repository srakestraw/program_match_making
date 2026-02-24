import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const chipClass = "rounded-full border border-slate-300 px-3 py-1 text-xs font-medium transition hover:border-slate-500 hover:bg-slate-100";
const normalize = (value) => value.trim().toLowerCase().replaceAll(/\s+/g, "_");
const labelize = (value) => value.replaceAll("_", " ");
export function ChipSelectWithCustom({ label, options, value, onChange, addPlaceholder }) {
    const [draft, setDraft] = useState("");
    const allOptions = [...new Set([...options, ...value])];
    const addCustom = () => {
        const next = normalize(draft);
        if (!next || value.includes(next)) {
            setDraft("");
            return;
        }
        onChange([...value, next]);
        setDraft("");
    };
    return (_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium uppercase tracking-wide text-slate-600", children: label }), _jsx("div", { className: "mb-2 flex flex-wrap gap-2", children: allOptions.map((item) => {
                    const selected = value.includes(item);
                    return (_jsx("button", { type: "button", className: `${chipClass} ${selected ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : ""}`, onClick: () => onChange(selected ? value.filter((entry) => entry !== item) : [...value, item]), children: labelize(item) }, item));
                }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: addPlaceholder, value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                addCustom();
                            }
                        } }), _jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50", onClick: addCustom, children: "Add" })] })] }));
}

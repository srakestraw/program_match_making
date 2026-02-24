import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { brandVoiceTones } from "@pmm/domain";
const chipClass = "rounded-full border border-slate-300 px-3 py-1 text-xs font-medium transition hover:border-slate-500 hover:bg-slate-100";
const toneLabel = (value) => value.charAt(0).toUpperCase() + value.slice(1);
export function ToneSelector({ primaryTone, modifiers, onPrimaryToneChange, onModifiersChange }) {
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600", children: "Primary Tone" }), _jsx("select", { className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm", value: primaryTone, onChange: (event) => onPrimaryToneChange(event.target.value), children: brandVoiceTones.map((tone) => (_jsx("option", { value: tone, children: toneLabel(tone) }, tone))) })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium uppercase tracking-wide text-slate-600", children: "Tone Modifiers" }), _jsx("div", { className: "flex flex-wrap gap-2", children: brandVoiceTones.map((tone) => {
                            const selected = modifiers.includes(tone);
                            return (_jsx("button", { type: "button", className: `${chipClass} ${selected ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : ""}`, onClick: () => onModifiersChange(selected ? modifiers.filter((item) => item !== tone) : [...modifiers, tone]), children: toneLabel(tone) }, tone));
                        }) })] })] }));
}

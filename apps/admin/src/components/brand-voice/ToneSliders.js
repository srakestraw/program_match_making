import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const sliderRows = [
    { key: "formality", label: "Formality", minLabel: "Casual", maxLabel: "Professional" },
    { key: "warmth", label: "Warmth", minLabel: "Neutral", maxLabel: "Friendly" },
    { key: "directness", label: "Directness", minLabel: "Soft", maxLabel: "Direct" },
    { key: "confidence", label: "Confidence", minLabel: "Reserved", maxLabel: "Assertive" },
    { key: "energy", label: "Energy", minLabel: "Calm", maxLabel: "Energetic" }
];
export function ToneSliders({ value, onChange }) {
    return (_jsx("div", { className: "space-y-3", children: sliderRows.map((row) => (_jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-600", children: [_jsx("label", { children: row.label }), _jsx("span", { children: value[row.key] })] }), _jsx("input", { type: "range", min: 0, max: 100, value: value[row.key], className: "w-full", onChange: (event) => onChange({ ...value, [row.key]: Number(event.target.value) }) }), _jsxs("div", { className: "mt-1 flex justify-between text-xs text-slate-500", children: [_jsx("span", { children: row.minLabel }), _jsx("span", { children: row.maxLabel })] })] }, row.key))) }));
}

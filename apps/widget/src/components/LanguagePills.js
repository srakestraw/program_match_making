import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const LanguagePills = ({ valueTag, customLanguage, onChangeTag, onOpenOther, options }) => {
    const isCustomSelected = Boolean(customLanguage && customLanguage.tag.toLowerCase() === valueTag.toLowerCase());
    const otherPillLabel = isCustomSelected ? customLanguage?.label ?? "Other" : "Other";
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-2", "data-testid": "language-pills", children: [options.map((option) => {
                const selected = option.tag.toLowerCase() === valueTag.toLowerCase();
                return (_jsx("button", { type: "button", className: `rounded-full border px-3 py-1 text-xs font-medium ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`, onClick: () => onChangeTag(option.tag, option.label), children: option.label }, option.tag));
            }), _jsx("button", { type: "button", className: `rounded-full border px-3 py-1 text-xs font-medium ${isCustomSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`, onClick: onOpenOther, "data-testid": "language-pill-other", children: otherPillLabel })] }));
};

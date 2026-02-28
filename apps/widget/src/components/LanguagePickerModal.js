import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export const LanguagePickerModal = ({ open, options, onClose, onSelect }) => {
    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query)
            return options;
        return options.filter((option) => option.label.toLowerCase().includes(query) || option.tag.toLowerCase().includes(query));
    }, [options, search]);
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "w-full max-w-md rounded-lg border border-slate-300 bg-white p-3 shadow-lg", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-900", children: "Choose language" }), _jsx("button", { type: "button", className: "text-xs text-slate-600 underline", onClick: onClose, children: "Close" })] }), _jsx("input", { className: "mb-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm", placeholder: "Type a language", value: search, onChange: (event) => setSearch(event.target.value) }), _jsxs("div", { className: "max-h-64 space-y-1 overflow-y-auto", children: [filtered.map((option) => (_jsx("button", { type: "button", className: "w-full rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm hover:border-slate-900", onClick: () => {
                                onSelect(option.tag, option.label);
                                setSearch("");
                            }, children: option.label }, option.tag))), filtered.length === 0 && _jsx("p", { className: "text-xs text-slate-500", children: "No language matches your search." })] })] }) }));
};

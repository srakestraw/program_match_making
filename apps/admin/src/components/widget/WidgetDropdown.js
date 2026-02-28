import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
const navLinkClass = "rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-200";
export function WidgetDropdown() {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const location = useLocation();
    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);
    useEffect(() => {
        if (!open)
            return;
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [open]);
    return (_jsxs("div", { className: "relative", ref: ref, children: [_jsx("button", { type: "button", className: navLinkClass, onClick: () => setOpen((prev) => !prev), "aria-expanded": open, "aria-haspopup": "true", children: "Widget" }), open && (_jsxs("div", { className: "absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg", role: "menu", children: [_jsx(Link, { className: "block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100", to: "/widget/embed", role: "menuitem", children: "Embed Widget" }), _jsx(Link, { className: "block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100", to: "/widget/preview", role: "menuitem", children: "Candidate Preview" })] }))] }));
}

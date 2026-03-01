import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
const widgetBaseUrl = import.meta.env.VITE_WIDGET_URL ??
    (typeof window !== "undefined" ? `${window.location.origin.replace(/:\d+$/, ":5174")}` : "http://localhost:5174");
const previewUrl = `${widgetBaseUrl.replace(/\/$/, "")}/?preview=1`;
export function AdminWidgetPreviewPage() {
    return (_jsxs("div", { className: "relative -m-4 h-[calc(100vh-6rem)] min-h-[480px]", children: [_jsxs("div", { className: "absolute right-4 top-4 z-10 flex items-center gap-2", children: [_jsx(Link, { className: "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow hover:bg-slate-50", to: "/widget/orchestration", children: "Configure Orchestration" }), _jsx("span", { className: "rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 shadow", "aria-hidden": true, children: "Preview Mode" })] }), _jsx("iframe", { src: previewUrl, title: "Candidate Widget Preview", className: "h-full w-full rounded-md border border-slate-200 bg-white", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups", allow: "microphone" })] }));
}

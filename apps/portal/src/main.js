import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { AppShell, Card } from "@pmm/ui";
import "./styles.css";
const cards = [
    {
        name: "Admin",
        description: "Manage traits, programs, and brand voice settings.",
        url: "http://localhost:5173"
    },
    {
        name: "Candidate Widget",
        description: "Run the candidate interview flow (voice/chat/quiz).",
        url: "http://localhost:5174/widget"
    },
    {
        name: "Advisor",
        description: "View candidate leads and follow-up workflow.",
        url: "http://localhost:5175"
    }
];
const App = () => {
    return (_jsx(AppShell, { children: _jsxs("main", { className: "mx-auto min-h-screen max-w-5xl px-6 py-12", children: [_jsxs("div", { className: "mb-8 space-y-3", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.2em] text-slate-600", children: "Program Match Making" }), _jsx("h1", { className: "text-4xl font-bold text-slate-900", children: "App Portal" }), _jsx("p", { className: "max-w-2xl text-sm text-slate-700", children: "Use this page to jump to each product surface during local development." })] }), _jsx("section", { className: "grid gap-4 md:grid-cols-3", children: cards.map((card) => (_jsx(Card, { children: _jsxs("div", { className: "flex h-full flex-col gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-xl font-semibold text-slate-900", children: card.name }), _jsx("p", { className: "text-sm text-slate-600", children: card.description })] }), _jsx("a", { href: card.url, className: "mt-auto inline-flex w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700", children: "Open app" })] }) }, card.name))) })] }) }));
};
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));

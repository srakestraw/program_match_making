import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { InterviewTypeIllustration } from "./InterviewTypeIllustration";
const items = [
    { type: "voice", label: "Voice" },
    { type: "chat", label: "Chat" },
    { type: "quiz", label: "Quiz" }
];
export const IllustrationsDemo = () => {
    return (_jsxs("section", { className: "rounded-md border border-slate-200 bg-white p-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-slate-500", children: "Dev only preview" }), _jsx("div", { className: "mt-2 flex items-center gap-4", children: items.map((item) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(InterviewTypeIllustration, { type: item.type, size: 38 }), _jsx("span", { className: "text-xs text-slate-600", children: item.label })] }, item.type))) }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "quiz-demo-state", children: [_jsx(InterviewTypeIllustration, { type: "quiz", size: 38, quizVariant: "arrow" }), _jsx("span", { className: "text-[11px] text-slate-500", children: "ambient shuffle" })] }), _jsxs("div", { className: "quiz-demo-state", children: [_jsx(InterviewTypeIllustration, { type: "quiz", size: 38, quizVariant: "ghost" }), _jsx("span", { className: "text-[11px] text-slate-500", children: "variant B" })] })] })] }));
};

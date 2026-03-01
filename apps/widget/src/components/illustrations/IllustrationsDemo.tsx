import React from "react";
import { InterviewTypeIllustration } from "./InterviewTypeIllustration";

const items: Array<{ type: "voice" | "chat" | "quiz"; label: string }> = [
  { type: "voice", label: "Voice" },
  { type: "chat", label: "Chat" },
  { type: "quiz", label: "Quiz" }
];

export const IllustrationsDemo = () => {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dev only preview</p>
      <div className="mt-2 flex items-center gap-4">
        {items.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <InterviewTypeIllustration type={item.type} size={38} />
            <span className="text-xs text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="quiz-demo-state">
          <InterviewTypeIllustration type="quiz" size={38} quizVariant="arrow" />
          <span className="text-[11px] text-slate-500">ambient shuffle</span>
        </div>
        <div className="quiz-demo-state">
          <InterviewTypeIllustration type="quiz" size={38} quizVariant="ghost" />
          <span className="text-[11px] text-slate-500">variant B</span>
        </div>
      </div>
    </section>
  );
};

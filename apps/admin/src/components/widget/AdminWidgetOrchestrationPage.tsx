import React from "react";
import { Card } from "@pmm/ui";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600";

export function AdminWidgetOrchestrationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Interview Orchestration</h1>
      <p className="text-sm text-slate-600">Tune how the interviewer balances follow-up depth and trait rotation.</p>

      <Card>
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Rotation Behavior</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelClass}>Max Follow-Ups Per Trait</label>
              <select className={inputClass} defaultValue="1">
                <option value="0">0 (No follow-up)</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Rotation Strictness</label>
              <select className={inputClass} defaultValue="balanced">
                <option value="balanced">Balanced</option>
                <option value="strict">Strict</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Min Traits Before Revisit</label>
              <select className={inputClass} defaultValue="2">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          </div>
        </section>
      </Card>

      <Card>
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Checkpoint Behavior</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Checkpoint Every</label>
              <select className={inputClass} defaultValue="3">
                <option value="2">2 turns</option>
                <option value="3">3 turns</option>
                <option value="4">4 turns</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Focus Mode Behavior</label>
              <select className={inputClass} defaultValue="gaps">
                <option value="gaps">Gap traits first</option>
                <option value="critical">Program-critical first</option>
              </select>
            </div>
          </div>
        </section>
      </Card>

      <Card>
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Interviewer Guide</h2>
          <div>
            <label className={labelClass}>Style Guide Prompt</label>
            <textarea
              className={`${inputClass} min-h-28`}
              defaultValue="Be concise, ask one question at a time, rotate traits quickly, and avoid repetitive probing unless the candidate asks to go deeper."
            />
          </div>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked />
              One question at a time
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked />
              Limit question length
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked />
              Enforce trait rotation
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Allow candidate-led deep dive
            </label>
          </div>
          <p className="text-xs text-slate-500">This is a UI mock. Save/apply wiring can be added next.</p>
        </section>
      </Card>
    </div>
  );
}

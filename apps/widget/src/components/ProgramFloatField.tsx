import { useEffect, useMemo, useRef, useState } from "react";
import type { ProgramFit } from "@pmm/api-client";

type ProgramFloatFieldProps = {
  programs: ProgramFit["programs"];
  selectedProgramId?: string | null;
  done?: boolean;
};

const confidenceLabel = (value?: number) => {
  if (!Number.isFinite(value)) return "Low";
  if ((value ?? 0) >= 0.75) return "High";
  if ((value ?? 0) >= 0.5) return "Medium";
  return "Low";
};

export const ProgramFloatField = ({ programs, selectedProgramId, done = false }: ProgramFloatFieldProps) => {
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const ranked = useMemo(() => [...programs].sort((a, b) => b.fitScore_0_to_100 - a.fitScore_0_to_100).slice(0, 3), [programs]);
  const previousRankRef = useRef<Record<string, number>>({});
  const [rankDelta, setRankDelta] = useState<Record<string, number>>({});

  useEffect(() => {
    const nextMap: Record<string, number> = {};
    const deltaMap: Record<string, number> = {};
    ranked.forEach((program, index) => {
      nextMap[program.programId] = index;
      const previous = previousRankRef.current[program.programId];
      if (typeof previous === "number") {
        deltaMap[program.programId] = previous - index;
      } else {
        deltaMap[program.programId] = 0;
      }
    });
    previousRankRef.current = nextMap;
    setRankDelta(deltaMap);
  }, [ranked]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white/80 p-3" data-testid="program-float-field">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{done ? "Final rankings" : "Live program rankings"}</h3>
        <span className="text-xs text-slate-500">Top 3</span>
      </div>

      <div className="space-y-2">
        {ranked.map((program, index) => {
          const expanded = expandedProgramId === program.programId;
          const isSelected = selectedProgramId === program.programId;
          const confidencePct = Math.round((program.confidence_0_to_1 ?? 0) * 100);
          const delta = program.deltaFromLast_0_to_100 ?? 0;
          const positiveDelta = delta > 0;

          return (
            <article
              key={program.programId}
              className={`rounded-md border p-2 transition-all duration-300 ${isSelected ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {index + 1}. {program.programName}
                  </p>
                  <p className="text-xs text-slate-600">Score: {program.fitScore_0_to_100.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                    {confidenceLabel(program.confidence_0_to_1)} {confidencePct}%
                  </span>
                  {rankDelta[program.programId] !== 0 && (
                    <p
                      className={`mt-1 text-[10px] font-semibold ${
                        (rankDelta[program.programId] ?? 0) > 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {(rankDelta[program.programId] ?? 0) > 0 ? "▲" : "▼"} {Math.abs(rankDelta[program.programId] ?? 0)} rank
                    </p>
                  )}
                  <p className={`mt-1 text-xs font-medium ${positiveDelta ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-slate-500"}`}>
                    Delta {positiveDelta ? "+" : ""}
                    {delta.toFixed(1)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="mt-1 text-xs text-slate-700 underline"
                onClick={() => setExpandedProgramId((prev) => (prev === program.programId ? null : program.programId))}
              >
                {expanded ? "Hide explainability" : "Why this match?"}
              </button>

              {expanded && (
                <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                  <div>
                    <p className="font-semibold text-slate-900">Top contributing traits</p>
                    <ul className="mt-1 space-y-0.5">
                      {(program.explainability?.topContributors ?? []).slice(0, 3).map((item) => (
                        <li key={`${program.programId}-top-${item.traitId}`}>
                          {(item.publicLabel ?? item.traitName)} ({Math.round(item.contribution * 100)}%)
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Weak or missing traits</p>
                    <ul className="mt-1 space-y-0.5">
                      {(program.explainability?.gaps ?? []).slice(0, 3).map((item) => (
                        <li key={`${program.programId}-gap-${item.traitId}`}>
                          {item.traitName} ({item.reason.replace("_", " ")})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">What increases confidence</p>
                    <ul className="mt-1 space-y-0.5">
                      {(program.explainability?.suggestions ?? []).slice(0, 2).map((item) => (
                        <li key={`${program.programId}-suggest-${item.traitId}`}>{item.traitName}: {item.reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {ranked.length === 0 && <p className="text-xs text-slate-500">Ranking updates will appear once responses arrive.</p>}
      </div>
    </section>
  );
};

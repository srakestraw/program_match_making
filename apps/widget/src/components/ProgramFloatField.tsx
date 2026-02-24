import { useEffect, useMemo, useState } from "react";
import type { ProgramFit } from "@pmm/api-client";
import { computeProgramBubbleLayout } from "../lib/programFloatLayout";

type ProgramFloatFieldProps = {
  programs: ProgramFit["programs"];
  selectedProgramId?: string | null;
  done?: boolean;
};

export const ProgramFloatField = ({ programs, selectedProgramId, done = false }: ProgramFloatFieldProps) => {
  const [pinnedProgramId, setPinnedProgramId] = useState<string | null>(null);
  const [frozenLayout, setFrozenLayout] = useState<ReturnType<typeof computeProgramBubbleLayout> | null>(null);

  const layout = useMemo(
    () => computeProgramBubbleLayout({ programs, selectedProgramId: selectedProgramId ?? null }),
    [programs, selectedProgramId]
  );

  useEffect(() => {
    if (done && !frozenLayout) {
      setFrozenLayout(layout);
      return;
    }
    if (!done && frozenLayout) {
      setFrozenLayout(null);
    }
  }, [done, frozenLayout, layout]);

  const programsById = useMemo(() => new Map(programs.map((program) => [program.programId, program])), [programs]);
  const ranked = useMemo(() => [...programs].sort((a, b) => b.fitScore_0_to_100 - a.fitScore_0_to_100), [programs]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white/80 p-3" data-testid="program-float-field">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Program fit radar</h3>
        <span className="text-xs text-slate-500">Click to pin</span>
      </div>

      <div className="relative h-[320px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100">
        {(frozenLayout ?? layout).map((bubble) => {
          const program = programsById.get(bubble.programId);
          if (!program) return null;

          const isSelected = selectedProgramId === bubble.programId;
          const isPinned = pinnedProgramId === bubble.programId;

          return (
            <button
              key={bubble.programId}
              type="button"
              className={`absolute rounded-full border text-center shadow-sm transition-all duration-700 ease-out ${
                isSelected ? "border-blue-500 bg-blue-100/80" : "border-slate-300 bg-white/85"
              } ${isPinned ? "ring-2 ring-blue-400" : ""}`}
              style={{
                width: `${bubble.sizePx}px`,
                height: `${bubble.sizePx}px`,
                transform: `translate(-50%, -50%) translate(${bubble.xPct}%, ${bubble.yPct}%)`,
                opacity: bubble.opacity,
                zIndex: isPinned ? 20 : isSelected ? 15 : 10
              }}
              onClick={() => setPinnedProgramId((prev) => (prev === bubble.programId ? null : bubble.programId))}
              data-testid={`program-bubble-${bubble.programId}`}
            >
              <span className="block px-2 pt-3 text-[11px] font-semibold leading-tight text-slate-900">{program.programName}</span>
              <span className="block px-2 text-[10px] text-slate-600">{Math.round(program.fitScore_0_to_100)}%</span>
              <span className="mt-1 block px-2 text-[9px] text-slate-500">{program.topTraits.slice(0, 2).map((item) => item.traitName).join(" · ")}</span>

              {(isPinned || isSelected) && (
                <span className="pointer-events-none absolute -bottom-24 left-1/2 w-44 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-[10px] text-slate-700 shadow-md">
                  {program.topTraits.slice(0, 3).map((item) => (
                    <span key={`${bubble.programId}-${item.traitName}`} className="block">
                      {item.traitName}: {item.delta > 0 ? "+" : ""}
                      {item.delta.toFixed(2)}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {done && (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
          <p className="mb-1 text-xs font-semibold text-slate-900">Final ranking</p>
          <ol className="space-y-1 text-xs text-slate-700">
            {ranked.map((item, index) => (
              <li key={item.programId}>
                {index + 1}. {item.programName} - {item.fitScore_0_to_100.toFixed(1)}%
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};

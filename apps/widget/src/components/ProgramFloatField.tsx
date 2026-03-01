import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ProgramFit } from "@pmm/api-client";

type ProgramFloatFieldProps = {
  programs: ProgramFit["programs"];
  selectedProgramId?: string | null;
  done?: boolean;
  updatingMatches?: boolean;
  reducedMotion?: boolean;
  pulseToken?: number | null;
};

const confidenceLabel = (value?: number) => {
  if (!Number.isFinite(value)) return "Low";
  if ((value ?? 0) >= 0.75) return "High";
  if ((value ?? 0) >= 0.5) return "Medium";
  return "Low";
};

const fitNarrativeLabel = (score: number) => {
  if (score >= 80) return "High fit";
  if (score >= 55) return "Strong alignment forming";
  return "Alignment still forming";
};

const deltaNarrativeLabel = (delta: number) => {
  if (delta > 0.25) return "Trending upward";
  if (delta < -0.25) return "Rebalancing fit signals";
  return "Holding steady";
};

export const ProgramFloatField = ({
  programs,
  selectedProgramId,
  done = false,
  updatingMatches = false,
  reducedMotion = false,
  pulseToken = null
}: ProgramFloatFieldProps) => {
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const ranked = useMemo(() => [...programs].sort((a, b) => b.fitScore_0_to_100 - a.fitScore_0_to_100).slice(0, 3), [programs]);
  const previousRankRef = useRef<Record<string, number>>({});
  const previousTopRef = useRef<Record<string, number>>({});
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [rankDelta, setRankDelta] = useState<Record<string, number>>({});
  const [movementBadge, setMovementBadge] = useState<Record<string, string>>({});
  const [pulseProgramId, setPulseProgramId] = useState<string | null>(null);

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

    const movement: Record<string, string> = {};
    ranked.forEach((program) => {
      const delta = deltaMap[program.programId] ?? 0;
      if (delta > 0) movement[program.programId] = `Moved up ${Math.abs(delta)}`;
      if (delta < 0) movement[program.programId] = `Down ${Math.abs(delta)}`;
    });
    setMovementBadge(movement);
    if (Object.keys(movement).length > 0) {
      const timeout = window.setTimeout(() => setMovementBadge({}), reducedMotion ? 220 : 820);
      return () => window.clearTimeout(timeout);
    }
  }, [ranked, reducedMotion]);

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const nextTop: Record<string, number> = {};
    ranked.forEach((program) => {
      const node = cardRefs.current[program.programId];
      if (!node) return;
      const rect = node.getBoundingClientRect();
      nextTop[program.programId] = rect.top;
      const previous = previousTopRef.current[program.programId];
      if (typeof previous === "number") {
        const deltaY = previous - rect.top;
        if (Math.abs(deltaY) > 1) {
          node.animate(
            [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0px)" }],
            { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          );
        }
      }
    });
    previousTopRef.current = nextTop;
  }, [ranked, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !pulseToken || !ranked[0]?.programId) return;
    setPulseProgramId(ranked[0].programId);
    const timeout = window.setTimeout(() => setPulseProgramId(null), 460);
    return () => window.clearTimeout(timeout);
  }, [pulseToken, ranked, reducedMotion]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white/80 p-3" data-testid="program-float-field">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{done ? "Final rankings" : "Live program rankings"}</h3>
        <span className="live-chip text-xs">Top 3</span>
      </div>
      {updatingMatches && <p className="rankings-updating text-xs">Updating matches...</p>}

      <div className="space-y-2">
        {ranked.map((program, index) => {
          const expanded = expandedProgramId === program.programId;
          const isSelected = selectedProgramId === program.programId;
          const confidencePct = Math.round((program.confidence_0_to_1 ?? 0) * 100);
          const delta = program.deltaFromLast_0_to_100 ?? 0;
          const fitNarrative = fitNarrativeLabel(program.fitScore_0_to_100);
          const deltaNarrative = deltaNarrativeLabel(delta);

          return (
            <article
              key={program.programId}
              ref={(node) => {
                cardRefs.current[program.programId] = node;
              }}
              className={`program-rank-card rounded-md border p-2 transition-all duration-300 ${
                isSelected ? "program-rank-card-selected" : "border-slate-200 bg-white"
              } ${pulseProgramId === program.programId ? "program-rank-card-pulse" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {index + 1}. {program.programName}
                  </p>
                  <p className="text-xs font-semibold text-slate-700">{fitNarrative}</p>
                </div>
                <div className="text-right">
                  <span className="quiz-chip rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {confidenceLabel(program.confidence_0_to_1)} {confidencePct}%
                  </span>
                  {movementBadge[program.programId] && (
                    <p className={`movement-badge mt-1 text-[10px] font-semibold ${(rankDelta[program.programId] ?? 0) > 0 ? "movement-up" : "movement-down"}`}>
                      {movementBadge[program.programId]}
                    </p>
                  )}
                  <p className={`mt-1 text-xs font-medium ${delta > 0.25 ? "movement-up" : delta < -0.25 ? "movement-down" : "text-slate-500"}`}>
                    {deltaNarrative}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="why-match-link mt-1 text-xs underline"
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

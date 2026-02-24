import { useMemo, useState } from "react";
import type { ScoringSnapshot } from "@pmm/api-client";

type TraitScorePanelProps = {
  traits: ScoringSnapshot["traits"];
  activeTraitId?: string | null;
  done?: boolean;
};

const confidenceClass: Record<"low" | "medium" | "high", string> = {
  low: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-emerald-100 text-emerald-700"
};

const statusClass: Record<"unanswered" | "active" | "complete", string> = {
  unanswered: "bg-slate-100 text-slate-600",
  active: "bg-blue-100 text-blue-700",
  complete: "bg-emerald-100 text-emerald-700"
};

const SegmentedScore = ({ score }: { score: number | null }) => {
  const rounded = score === null ? 0 : Math.max(1, Math.min(5, Math.round(score)));

  return (
    <div className="flex gap-1" aria-label="trait-score-segments">
      {[1, 2, 3, 4, 5].map((segment) => (
        <span
          key={segment}
          className={`h-2.5 w-5 rounded-full ${segment <= rounded ? "bg-slate-900" : "bg-slate-200"}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
};

export const TraitScorePanel = ({ traits, activeTraitId, done = false }: TraitScorePanelProps) => {
  const [expandedTraitIds, setExpandedTraitIds] = useState<Record<string, boolean>>({});
  const ordered = useMemo(() => traits, [traits]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white/80 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Trait scoring</h3>
        <span className="text-xs text-slate-500">Live</span>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {ordered.map((trait) => {
          const isActive = trait.traitId === activeTraitId || trait.status === "active";
          const expanded = expandedTraitIds[trait.traitId] ?? false;
          const evidence = trait.evidence.slice(0, expanded ? 10 : 2);

          return (
            <article
              key={trait.traitId}
              className={`rounded-md border p-2 ${isActive ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-white"}`}
              data-testid={`trait-row-${trait.traitId}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{trait.traitName}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass[trait.status]}`}>
                  {trait.status === "active" ? "in-progress" : trait.status}
                </span>
              </div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <SegmentedScore score={trait.score_1_to_5} />
                {trait.confidence && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${confidenceClass[trait.confidence]}`}>
                    {trait.confidence}
                  </span>
                )}
              </div>
              {evidence.length > 0 && (
                <ul className="space-y-0.5 text-xs text-slate-700">
                  {evidence.map((entry, index) => (
                    <li key={`${trait.traitId}-evidence-${index}`} className="truncate">
                      {entry}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1 flex gap-3 text-xs">
                {trait.evidence.length > 2 && (
                  <button
                    type="button"
                    className="text-slate-600 underline"
                    onClick={() => setExpandedTraitIds((prev) => ({ ...prev, [trait.traitId]: !expanded }))}
                  >
                    {expanded ? "Collapse evidence" : "Expand evidence"}
                  </button>
                )}
                {trait.rationale && (
                  <button
                    type="button"
                    className="text-slate-700 underline"
                    onClick={() => setExpandedTraitIds((prev) => ({ ...prev, [trait.traitId]: !expanded }))}
                  >
                    Why this score?
                  </button>
                )}
              </div>
              {expanded && trait.rationale && <p className="mt-1 text-xs text-slate-700">{trait.rationale}</p>}
            </article>
          );
        })}
        {ordered.length === 0 && <p className="text-xs text-slate-500">No trait scoring data yet.</p>}
      </div>
      {done && <p className="mt-2 text-xs text-slate-500">Finalized trait breakdown.</p>}
    </section>
  );
};

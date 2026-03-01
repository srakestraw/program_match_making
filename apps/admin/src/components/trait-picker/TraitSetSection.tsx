import React, { useState } from "react";
import type { TraitCategory } from "@pmm/domain";
import type { SuggestedSet } from "./suggested-sets";

type SetWithTraits = SuggestedSet & { traitIds: string[] };

export type TraitSetSectionProps = {
  sets: SetWithTraits[];
  traitsById: Map<
    string,
    { id: string; name: string; definition: string | null; status: "DRAFT" | "IN_REVIEW" | "ACTIVE" | "DEPRECATED" }
  >;
  alreadyAddedTraitIds: Set<string>;
  selectedTraitIds: Set<string>;
  previewSetId: string | null;
  onPreviewSet: (setId: string) => void;
  onSelectSet: (setId: string) => void;
  isLoading: boolean;
  activeCategory: TraitCategory | "ALL";
  hasSearch: boolean;
};

export function TraitSetSection({
  sets,
  traitsById,
  alreadyAddedTraitIds,
  selectedTraitIds,
  previewSetId,
  onPreviewSet,
  onSelectSet,
  isLoading,
  activeCategory,
  hasSearch
}: TraitSetSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <section className="rounded-md border border-slate-200/70 bg-white/80 p-3">
        <div className="mb-2 h-4 w-52 animate-pulse rounded bg-slate-200/70" />
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded bg-slate-100" />
          <div className="h-16 animate-pulse rounded bg-slate-100" />
        </div>
      </section>
    );
  }

  if (sets.length === 0) return null;

  const categoryLabel = activeCategory === "ALL" ? "All categories" : activeCategory;

  return (
    <section className="rounded-md border border-slate-200/70 bg-white/80 p-3">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1 text-left text-sm font-semibold text-slate-800 hover:text-slate-900"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse sets" : "Expand sets"}
      >
        Sets (based on your selection)
        <span className="text-slate-500" aria-hidden>
          {isExpanded ? "\u25BC" : "\u25B6"}
        </span>
      </button>
      {hasSearch && (
        <p className="mt-1 text-xs text-slate-500">Based on {categoryLabel} and your search</p>
      )}
      {isExpanded && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {sets.map((set) => {
            const isPreviewOpen = previewSetId === set.id;
            const addableCount = set.traitIds.filter((id) => !alreadyAddedTraitIds.has(id)).length;
            return (
              <div key={set.id} data-set-id={set.id} className="rounded-md border border-slate-200/80 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{set.name}</p>
                    <p className="text-xs text-slate-500">{set.traitIds.length} traits</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPreviewSet(set.id)}
                      aria-label={`Preview set ${set.name}`}
                      className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectSet(set.id)}
                      aria-label={`Select set ${set.name}`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Select set
                    </button>
                  </div>
                </div>
                {isPreviewOpen && (
                  <ul className="mt-3 space-y-1.5 border-t border-slate-200/80 pt-2">
                    {set.traitIds.map((traitId) => {
                      const trait = traitsById.get(traitId);
                      if (!trait) return null;
                      const isAdded = alreadyAddedTraitIds.has(trait.id);
                      const isSelected = selectedTraitIds.has(trait.id);
                      return (
                        <li key={trait.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-800">{trait.name}</span>
                            {isAdded ? (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                                Already added
                              </span>
                            ) : isSelected ? (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                                Selected
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                Available
                              </span>
                            )}
                            {trait.status !== "ACTIVE" && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                                Excluded from scoring
                              </span>
                            )}
                          </div>
                          {trait.definition && <p className="mt-0.5 text-slate-500">{trait.definition}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

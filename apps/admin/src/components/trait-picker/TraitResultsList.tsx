import React from "react";
import type { TraitCategory } from "@pmm/domain";

export type TraitResultsListItem = {
  id: string;
  name: string;
  category: TraitCategory;
  status: "DRAFT" | "IN_REVIEW" | "ACTIVE" | "DEPRECATED";
  definition: string | null;
};

export type TraitResultsListProps = {
  traits: TraitResultsListItem[];
  activeCategory: TraitCategory | "ALL";
  totalTraitsInActiveCategory: number;
  searchQuery: string;
  alreadyAddedTraitIds: Set<string>;
  selectedTraitIds: Set<string>;
  onToggleTrait: (traitId: string) => void;
  isLoading: boolean;
};

export function TraitResultsList({
  traits,
  activeCategory,
  totalTraitsInActiveCategory,
  searchQuery,
  alreadyAddedTraitIds,
  selectedTraitIds,
  onToggleTrait,
  isLoading
}: TraitResultsListProps) {
  let emptyState = "No traits match your search.";
  if (!searchQuery.trim() && activeCategory !== "ALL" && totalTraitsInActiveCategory === 0) {
    emptyState = "No traits in this category yet.";
  } else if (!searchQuery.trim() && activeCategory === "ALL") {
    emptyState = "No traits in this category yet.";
  }

  return (
    <section aria-label="Traits results" className="min-h-0 rounded-md border border-slate-200/70 bg-white/80 p-3">
      <h4 className="mb-2 text-sm font-semibold text-slate-800">Traits</h4>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded bg-slate-100" />
          <div className="h-14 animate-pulse rounded bg-slate-100" />
          <div className="h-14 animate-pulse rounded bg-slate-100" />
        </div>
      ) : traits.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">{emptyState}</p>
      ) : (
        <ul className="space-y-1.5">
          {traits.map((trait) => {
            const isOnBoard = alreadyAddedTraitIds.has(trait.id);
            const isSelected = selectedTraitIds.has(trait.id);
            const canSelect = !isOnBoard;

            const handleRowClick = (e: React.MouseEvent) => {
              if (!canSelect) return;
              if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
              e.preventDefault();
              onToggleTrait(trait.id);
            };

            return (
              <li
                key={trait.id}
                role="button"
                tabIndex={canSelect ? 0 : -1}
                onClick={handleRowClick}
                onKeyDown={(e) => {
                  if (!canSelect) return;
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onToggleTrait(trait.id);
                  }
                }}
                className={`flex cursor-default items-start gap-3 rounded-md border px-3 py-2 ${
                  isOnBoard
                    ? "cursor-not-allowed border-slate-200/80 bg-slate-50/80 opacity-75"
                    : "cursor-pointer border-slate-200/80 bg-white hover:bg-slate-50/80"
                }`}
                aria-disabled={isOnBoard}
                aria-pressed={canSelect ? isSelected : undefined}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isOnBoard}
                  onChange={() => canSelect && onToggleTrait(trait.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={isOnBoard ? `${trait.name} (on board)` : `${trait.name}${isSelected ? ", selected" : ""}`}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-slate-700 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{trait.name}</p>
                    {isOnBoard && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                        Added
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {trait.status.replaceAll("_", " ")}
                    </span>
                    {trait.status !== "ACTIVE" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                        Excluded from scoring
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {trait.definition ?? "No description"}
                  </p>
                  {isOnBoard && <p className="mt-0.5 text-[11px] text-slate-500">Already on board</p>}
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {trait.category}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

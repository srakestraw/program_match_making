import React from "react";
import type { TraitCategory } from "@pmm/domain";
import type { SuggestedSet } from "./suggested-sets";
import { SuggestedSets } from "./SuggestedSets";

export type TraitListItem = {
  id: string;
  name: string;
  category: TraitCategory;
  definition: string | null;
};

export type TraitListProps = {
  traits: TraitListItem[];
  suggestedSets: Array<SuggestedSet & { traitIds: string[] }>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sort: "alphabetical" | "most_used" | "recommended";
  onSortChange: (value: "alphabetical" | "most_used" | "recommended") => void;
  selectedIds: Set<string>;
  onAddTrait: (id: string) => void;
  assignedIds: Set<string>;
  onPreviewSet: (traitIds: string[]) => void;
  onAddSet: (traitIds: string[]) => void;
};

export function TraitList({
  traits,
  suggestedSets,
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
  selectedIds,
  onAddTrait,
  assignedIds,
  onPreviewSet,
  onAddSet
}: TraitListProps) {
  const showBrowseState = !searchQuery.trim();
  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
        <input
          type="search"
          className={inputClass}
          placeholder="Search traits"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search traits"
        />
        <select
          className={inputClass}
          value={sort}
          onChange={(e) => onSortChange(e.target.value as TraitListProps["sort"])}
          aria-label="Sort traits"
        >
          <option value="alphabetical">Alphabetical</option>
          <option value="most_used">Most used</option>
          <option value="recommended">Recommended</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {showBrowseState && suggestedSets.length > 0 && (
          <SuggestedSets sets={suggestedSets} onPreview={onPreviewSet} onAddSet={onAddSet} />
        )}
        <div className="space-y-1">
          {traits.map((trait) => {
            const isAssigned = assignedIds.has(trait.id);
            const isSelected = selectedIds.has(trait.id);
            const canAdd = !isAssigned && !isSelected;

            return (
              <div
                key={trait.id}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white py-2 pl-3 pr-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{trait.name}</div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {trait.definition ?? "No description"}
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {trait.category}
                  </span>
                </div>
                <div className="flex-shrink-0">
                  {isAssigned ? (
                    <span className="text-xs text-slate-400">On board</span>
                  ) : isSelected ? (
                    <span className="text-xs font-medium text-slate-600">Added</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddTrait(trait.id)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {traits.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">No traits match your filters or search.</p>
        )}
      </div>
    </div>
  );
}

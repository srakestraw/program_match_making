import React from "react";
import type { SuggestedSet } from "./suggested-sets";

export type SuggestedSetsProps = {
  sets: Array<SuggestedSet & { traitIds: string[] }>;
  onPreview: (traitIds: string[]) => void;
  onAddSet: (traitIds: string[]) => void;
};

export function SuggestedSets({ sets, onPreview, onAddSet }: SuggestedSetsProps) {
  if (sets.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">Suggested sets</h4>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((set) => (
          <div
            key={set.id}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="mb-2 font-medium text-slate-800">{set.name}</div>
            <p className="mb-3 text-xs text-slate-500">{set.traitIds.length} traits</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onPreview(set.traitIds)}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => onAddSet(set.traitIds)}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
              >
                Add set
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

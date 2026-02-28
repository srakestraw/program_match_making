import React from "react";
import { programTraitPriorityBuckets } from "@pmm/domain";
import type { ProgramTraitPriorityBucket } from "@pmm/domain";

export type SelectedTraitsPanelProps = {
  selectedTraits: Array<{ id: string; name: string }>;
  destinationBucket: ProgramTraitPriorityBucket;
  onDestinationChange: (bucket: ProgramTraitPriorityBucket) => void;
  onRemove: (traitId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SelectedTraitsPanel({
  selectedTraits,
  destinationBucket,
  onDestinationChange,
  onRemove,
  onConfirm,
  onCancel
}: SelectedTraitsPanelProps) {
  return (
    <div className="flex h-full w-full flex-shrink-0 flex-col border-t border-slate-200 bg-slate-50/30 md:w-[280px] md:border-t-0 md:border-l">
      <div className="border-b border-slate-200 p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Adding to</h4>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={destinationBucket}
          onChange={(e) => onDestinationChange(e.target.value as ProgramTraitPriorityBucket)}
          aria-label="Destination priority bucket"
        >
          {programTraitPriorityBuckets.map((bucket) => (
            <option key={bucket} value={bucket}>
              {bucket.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Selected</h4>
        {selectedTraits.length === 0 ? (
          <p className="text-sm text-slate-500">No traits selected.</p>
        ) : (
          <ul className="space-y-1.5">
            {selectedTraits.map((trait) => (
              <li
                key={trait.id}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate text-slate-800">{trait.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(trait.id)}
                  className="flex-shrink-0 rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Remove ${trait.name} from selection`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={selectedTraits.length === 0}
          className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add {selectedTraits.length} trait{selectedTraits.length !== 1 ? "s" : ""}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

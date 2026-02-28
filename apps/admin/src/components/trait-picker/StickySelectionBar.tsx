import React from "react";

export type StickySelectionBarProps = {
  selectedCount: number;
  onAdd: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function StickySelectionBar({
  selectedCount,
  onAdd,
  onCancel,
  isSubmitting
}: StickySelectionBarProps) {
  return (
    <footer
      role="region"
      aria-label="Selection actions"
      className="flex flex-shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-3"
    >
      <span className="text-sm text-slate-600">
        {selectedCount} selected
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={selectedCount === 0 || isSubmitting}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={selectedCount === 0 ? "Add traits (select at least one)" : `Add ${selectedCount} traits`}
        >
          {isSubmitting ? "Adding..." : `Add ${selectedCount} trait${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </footer>
  );
}

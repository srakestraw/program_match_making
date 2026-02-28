import React from "react";
import type { TraitCategory } from "@pmm/domain";
import { traitCategories } from "@pmm/domain";

const categoryCounts = (traits: Array<{ category: TraitCategory }>) => {
  const counts: Record<string, number> = {};
  for (const t of traits) {
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return counts;
};

type FilterKey = "recommended" | "popular" | "unassigned";

export type TraitCategoryRailProps = {
  traits: Array<{ category: TraitCategory }>;
  activeCategory: TraitCategory | "ALL";
  onCategoryChange: (category: TraitCategory | "ALL") => void;
  filters: Record<FilterKey, boolean>;
  onFilterChange: (key: FilterKey, value: boolean) => void;
  /** Count of traits not assigned to current program (for "Only unassigned" label) */
  unassignedCount: number;
};

export function TraitCategoryRail({
  traits,
  activeCategory,
  onCategoryChange,
  filters,
  onFilterChange,
  unassignedCount
}: TraitCategoryRailProps) {
  const counts = React.useMemo(() => categoryCounts(traits), [traits]);

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-slate-50/50">
      <div className="p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Category</h4>
        <nav className="space-y-0.5" aria-label="Trait categories">
          <button
            type="button"
            onClick={() => onCategoryChange("ALL")}
            className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${activeCategory === "ALL" ? "bg-slate-200 font-medium text-slate-800" : "text-slate-700 hover:bg-slate-100"}`}
          >
            All ({traits.length})
          </button>
          {traitCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${activeCategory === cat ? "bg-slate-200 font-medium text-slate-800" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {cat} ({counts[cat] ?? 0})
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-4 border-t border-slate-200 p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</h4>
        <div className="space-y-1.5">
          {[
            { key: "recommended" as const, label: "Recommended for this program" },
            { key: "popular" as const, label: "Popular" },
            { key: "unassigned" as const, label: `Only unassigned (${unassignedCount})` }
          ].map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(e) => onFilterChange(key, e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

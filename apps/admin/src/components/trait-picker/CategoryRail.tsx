import React from "react";
import type { TraitCategory } from "@pmm/domain";
import { traitCategories } from "@pmm/domain";

const categoryCounts = (traits: Array<{ category: TraitCategory }>) => {
  const counts: Record<string, number> = {};
  for (const trait of traits) {
    counts[trait.category] = (counts[trait.category] ?? 0) + 1;
  }
  return counts;
};

export type CategoryRailProps = {
  traits: Array<{ category: TraitCategory }>;
  activeCategory: TraitCategory | "ALL";
  onCategoryChange: (category: TraitCategory | "ALL") => void;
};

export function CategoryRail({ traits, activeCategory, onCategoryChange }: CategoryRailProps) {
  const counts = React.useMemo(() => categoryCounts(traits), [traits]);

  return (
    <div className="flex h-full flex-col bg-slate-50/40 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Category</h4>
      <nav className="space-y-1" aria-label="Trait categories">
        <button
          type="button"
          onClick={() => onCategoryChange("ALL")}
          className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
            activeCategory === "ALL"
              ? "bg-slate-200/70 font-medium text-slate-800"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          All ({traits.length})
        </button>
        {traitCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onCategoryChange(category)}
            className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
              activeCategory === category
                ? "bg-slate-200/70 font-medium text-slate-800"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {category} ({counts[category] ?? 0})
          </button>
        ))}
      </nav>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import type { TraitCategory } from "@pmm/domain";
import { ProgramTraitPriorityBucket, programTraitPriorityBuckets, traitCategories } from "@pmm/domain";
import { CategoryRail } from "./CategoryRail";
import { StickySelectionBar } from "./StickySelectionBar";
import { TraitResultsList } from "./TraitResultsList";
import { TraitSetSection } from "./TraitSetSection";
import { getSuggestedSets, resolveSuggestedSet } from "./suggested-sets";

export type TraitForPicker = {
  id: string;
  name: string;
  category: TraitCategory;
  definition: string | null;
  createdAt?: string;
};

type SortOption = "alphabetical" | "recently_added";

export type TraitPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  traits: TraitForPicker[];
  assignedTraitIds: Set<string>;
  programId: string | null;
  degreeLevel: string | null;
  department: string | null;
  onAddTraits: (traitIds: string[], destinationBucket: ProgramTraitPriorityBucket) => Promise<void> | void;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debouncedValue;
}

export function TraitPickerModal({
  isOpen,
  onClose,
  traits,
  assignedTraitIds,
  programId,
  degreeLevel,
  department,
  onAddTraits
}: TraitPickerModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<TraitCategory | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("alphabetical");
  const [selectedTraitIds, setSelectedTraitIds] = useState<Set<string>>(new Set());
  const [addingToBucketId, setAddingToBucketId] = useState<ProgramTraitPriorityBucket>("IMPORTANT");
  const [previewSetId, setPreviewSetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchQuery = useDebouncedValue(searchInput, 275);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCategoryId("ALL");
      setSearchInput("");
      setSortOption("alphabetical");
      setSelectedTraitIds(new Set());
      setAddingToBucketId("IMPORTANT");
      setPreviewSetId(null);
      setNotice(null);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, isSubmitting, onClose]);

  const alreadyAddedTraitIds = useMemo(() => new Set(assignedTraitIds), [assignedTraitIds]);
  const traitsById = useMemo(() => new Map(traits.map((trait) => [trait.id, trait])), [traits]);
  const hasTimestamp = useMemo(() => traits.some((trait) => Boolean(trait.createdAt)), [traits]);

  const categoryTraits = useMemo(() => {
    if (selectedCategoryId === "ALL") return traits;
    return traits.filter((trait) => trait.category === selectedCategoryId);
  }, [traits, selectedCategoryId]);

  const filteredTraits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = categoryTraits.filter((trait) => {
      if (!query) return true;
      return (
        trait.name.toLowerCase().includes(query) ||
        (trait.definition ?? "").toLowerCase().includes(query)
      );
    });

    if (sortOption === "alphabetical") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list = [...list].sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [categoryTraits, searchQuery, sortOption]);

  const suggestedSets = useMemo(
    () => getSuggestedSets(programId, degreeLevel, department),
    [programId, degreeLevel, department]
  );

  const contextualSets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return suggestedSets
      .map((set) => ({
        ...set,
        traitIds: resolveSuggestedSet(set, traits)
      }))
      .filter((set) => {
        if (set.traitIds.length === 0) return false;
        const resolvedTraits = set.traitIds.map((traitId) => traitsById.get(traitId)).filter(Boolean);
        const matchesCategory =
          selectedCategoryId === "ALL" ||
          resolvedTraits.some((trait) => trait?.category === selectedCategoryId);
        if (!matchesCategory) return false;
        if (!query) return true;
        return (
          set.name.toLowerCase().includes(query) ||
          resolvedTraits.some(
            (trait) =>
              trait?.name.toLowerCase().includes(query) ||
              (trait?.definition ?? "").toLowerCase().includes(query)
          )
        );
      });
  }, [suggestedSets, traits, traitsById, selectedCategoryId, searchQuery]);

  const isAlreadyAdded = (id: string) => alreadyAddedTraitIds.has(id);
  const isSelected = (id: string) => selectedTraitIds.has(id);

  const toggleTrait = (id: string) => {
    if (isAlreadyAdded(id)) return;
    setSelectedTraitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setNotice(null);
    setError(null);
  };

  const selectSet = (setId: string) => {
    const targetSet = contextualSets.find((set) => set.id === setId);
    if (!targetSet) return;
    const addableIds = targetSet.traitIds.filter((id) => !isAlreadyAdded(id) && !isSelected(id));

    if (addableIds.length === 0) {
      setNotice("All traits in this set are already added.");
      setError(null);
      return;
    }

    setSelectedTraitIds((prev) => new Set([...prev, ...addableIds]));
    setNotice(null);
    setError(null);
  };

  const previewSet = (setId: string) => {
    setPreviewSetId((current) => (current === setId ? null : setId));
  };

  const commitAdd = async () => {
    if (selectedTraitIds.size === 0 || isSubmitting) return;

    setNotice(null);
    setError(null);
    setIsSubmitting(true);
    try {
      await onAddTraits(Array.from(selectedTraitIds), addingToBucketId);
      onClose();
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : "Failed to add traits.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isLoadingResults = searchInput !== searchQuery;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trait-picker-title"
        className="flex h-[78vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-3">
          <h2 id="trait-picker-title" className="text-lg font-semibold text-slate-800">
            Add traits
          </h2>
          <div className="flex items-center gap-3">
            <label htmlFor="trait-picker-bucket" className="text-sm text-slate-600">
              Adding to:
            </label>
            <select
              id="trait-picker-bucket"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              value={addingToBucketId}
              onChange={(e) => setAddingToBucketId(e.target.value as ProgramTraitPriorityBucket)}
              aria-label="Destination priority bucket"
            >
              {programTraitPriorityBuckets.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Close"
              disabled={isSubmitting}
            >
              ×
            </button>
          </div>
        </div>

        {(notice || error) && (
          <div className="border-b border-slate-200/80 px-4 py-2 text-sm">
            {notice && <p className="text-emerald-700">{notice}</p>}
            {error && <p className="text-red-700">{error}</p>}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="hidden w-[220px] flex-shrink-0 border-r border-slate-200/80 md:block">
            <CategoryRail
              traits={traits}
              activeCategory={selectedCategoryId}
              onCategoryChange={setSelectedCategoryId}
            />
          </div>

          <div className="border-b border-slate-200/80 p-3 md:hidden">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </label>
            <select
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={selectedCategoryId}
              onChange={(event) =>
                setSelectedCategoryId((event.target.value || "ALL") as TraitCategory | "ALL")
              }
            >
              <option value="ALL">All ({traits.length})</option>
              {traitCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 p-3">
              <input
                type="search"
                className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Search traits"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label="Search traits"
              />
              <select
                className="w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
                aria-label="Sort traits"
              >
                <option value="alphabetical">Alphabetical</option>
                {hasTimestamp && <option value="recently_added">Recently added</option>}
              </select>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/20 p-3 pb-20">
              <TraitSetSection
                sets={contextualSets}
                traitsById={traitsById}
                alreadyAddedTraitIds={alreadyAddedTraitIds}
                selectedTraitIds={selectedTraitIds}
                previewSetId={previewSetId}
                onPreviewSet={previewSet}
                onSelectSet={selectSet}
                isLoading={isLoadingResults}
                activeCategory={selectedCategoryId}
                hasSearch={Boolean(searchQuery.trim())}
              />
              <TraitResultsList
                traits={filteredTraits}
                activeCategory={selectedCategoryId}
                totalTraitsInActiveCategory={categoryTraits.length}
                searchQuery={searchQuery}
                alreadyAddedTraitIds={alreadyAddedTraitIds}
                selectedTraitIds={selectedTraitIds}
                onToggleTrait={toggleTrait}
                isLoading={isLoadingResults}
              />
            </div>
          </div>

          <StickySelectionBar
            selectedCount={selectedTraitIds.size}
            onAdd={() => void commitAdd()}
            onCancel={onClose}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}

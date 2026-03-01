import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { programTraitPriorityBuckets, traitCategories } from "@pmm/domain";
import { CategoryRail } from "./CategoryRail";
import { StickySelectionBar } from "./StickySelectionBar";
import { TraitResultsList } from "./TraitResultsList";
import { TraitSetSection } from "./TraitSetSection";
import { getSuggestedSets, resolveSuggestedSet } from "./suggested-sets";
function useDebouncedValue(value, delayMs) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
        return () => window.clearTimeout(timeout);
    }, [value, delayMs]);
    return debouncedValue;
}
export function TraitPickerModal({ isOpen, onClose, traits, assignedTraitIds, programId, degreeLevel, department, onAddTraits }) {
    const [selectedCategoryId, setSelectedCategoryId] = useState("ALL");
    const [searchInput, setSearchInput] = useState("");
    const [sortOption, setSortOption] = useState("alphabetical");
    const [selectedTraitIds, setSelectedTraitIds] = useState(new Set());
    const [addingToBucketId, setAddingToBucketId] = useState("IMPORTANT");
    const [previewSetId, setPreviewSetId] = useState(null);
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);
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
        if (!isOpen)
            return;
        const handleEsc = (event) => {
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
        if (selectedCategoryId === "ALL")
            return traits;
        return traits.filter((trait) => trait.category === selectedCategoryId);
    }, [traits, selectedCategoryId]);
    const filteredTraits = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let list = categoryTraits.filter((trait) => {
            if (!query)
                return true;
            return (trait.name.toLowerCase().includes(query) ||
                (trait.definition ?? "").toLowerCase().includes(query));
        });
        const statusOrder = {
            ACTIVE: 0,
            IN_REVIEW: 1,
            DRAFT: 2,
            DEPRECATED: 3
        };
        if (sortOption === "alphabetical") {
            list = [...list].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name));
        }
        else {
            list = [...list].sort((a, b) => {
                const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
                const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
                return statusOrder[a.status] - statusOrder[b.status] || bTime - aTime || a.name.localeCompare(b.name);
            });
        }
        return list;
    }, [categoryTraits, searchQuery, sortOption]);
    const suggestedSets = useMemo(() => getSuggestedSets(programId, degreeLevel, department), [programId, degreeLevel, department]);
    const contextualSets = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return suggestedSets
            .map((set) => ({
            ...set,
            traitIds: resolveSuggestedSet(set, traits)
        }))
            .filter((set) => {
            if (set.traitIds.length === 0)
                return false;
            const resolvedTraits = set.traitIds
                .map((traitId) => traitsById.get(traitId))
                .filter((trait) => Boolean(trait));
            if (resolvedTraits.length === 0)
                return false;
            const matchesCategory = selectedCategoryId === "ALL" ||
                resolvedTraits.some((trait) => trait?.category === selectedCategoryId);
            if (!matchesCategory)
                return false;
            if (!query)
                return true;
            return (set.name.toLowerCase().includes(query) ||
                resolvedTraits.some((trait) => trait?.name.toLowerCase().includes(query) ||
                    (trait?.definition ?? "").toLowerCase().includes(query)));
        });
    }, [suggestedSets, traits, traitsById, selectedCategoryId, searchQuery]);
    const isAlreadyAdded = (id) => alreadyAddedTraitIds.has(id);
    const isSelected = (id) => selectedTraitIds.has(id);
    const toggleTrait = (id) => {
        if (isAlreadyAdded(id))
            return;
        const selectedTrait = traitsById.get(id);
        if (selectedTrait && selectedTrait.status !== "ACTIVE") {
            const proceed = window.confirm("This trait is not Active and will not affect scoring.");
            if (!proceed)
                return;
        }
        setSelectedTraitIds((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
        setNotice(null);
        setError(null);
    };
    const selectSet = (setId) => {
        const targetSet = contextualSets.find((set) => set.id === setId);
        if (!targetSet)
            return;
        const addableIds = targetSet.traitIds.filter((id) => {
            const trait = traitsById.get(id);
            if (!trait)
                return false;
            return !isAlreadyAdded(id) && !isSelected(id);
        });
        if (addableIds.length === 0) {
            setNotice("All traits in this set are already added.");
            setError(null);
            return;
        }
        const hasNonActive = addableIds.some((id) => {
            const trait = traitsById.get(id);
            return trait ? trait.status !== "ACTIVE" : false;
        });
        if (hasNonActive) {
            const proceed = window.confirm("This trait is not Active and will not affect scoring.");
            if (!proceed)
                return;
        }
        setSelectedTraitIds((prev) => new Set([...prev, ...addableIds]));
        setNotice(null);
        setError(null);
    };
    const previewSet = (setId) => {
        setPreviewSetId((current) => (current === setId ? null : setId));
    };
    const commitAdd = async () => {
        if (selectedTraitIds.size === 0 || isSubmitting)
            return;
        setNotice(null);
        setError(null);
        setIsSubmitting(true);
        try {
            await onAddTraits(Array.from(selectedTraitIds), addingToBucketId);
            onClose();
        }
        catch (commitError) {
            setError(commitError instanceof Error ? commitError.message : "Failed to add traits.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    if (!isOpen)
        return null;
    const isLoadingResults = searchInput !== searchQuery;
    return (_jsx("div", { className: "fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4", role: "presentation", children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "trait-picker-title", className: "flex h-[78vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-lg bg-white shadow-xl", children: [_jsxs("div", { className: "flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-3", children: [_jsx("h2", { id: "trait-picker-title", className: "text-lg font-semibold text-slate-800", children: "Add traits" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("label", { htmlFor: "trait-picker-bucket", className: "text-sm text-slate-600", children: "Adding to:" }), _jsx("select", { id: "trait-picker-bucket", className: "rounded-md border border-slate-300 px-3 py-1.5 text-sm", value: addingToBucketId, onChange: (e) => setAddingToBucketId(e.target.value), "aria-label": "Destination priority bucket", children: programTraitPriorityBuckets.map((bucket) => (_jsx("option", { value: bucket, children: bucket.replaceAll("_", " ") }, bucket))) }), _jsx("button", { type: "button", onClick: onClose, className: "rounded p-1 text-slate-500 hover:bg-slate-100", "aria-label": "Close", disabled: isSubmitting, children: "\u00D7" })] })] }), (notice || error) && (_jsxs("div", { className: "border-b border-slate-200/80 px-4 py-2 text-sm", children: [notice && _jsx("p", { className: "text-emerald-700", children: notice }), error && _jsx("p", { className: "text-red-700", children: error })] })), _jsxs("div", { className: "flex min-h-0 flex-1 flex-col md:flex-row", children: [_jsx("div", { className: "hidden w-[220px] flex-shrink-0 border-r border-slate-200/80 md:block", children: _jsx(CategoryRail, { traits: traits, activeCategory: selectedCategoryId, onCategoryChange: setSelectedCategoryId }) }), _jsxs("div", { className: "border-b border-slate-200/80 p-3 md:hidden", children: [_jsx("label", { className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Category" }), _jsxs("select", { className: "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm", value: selectedCategoryId, onChange: (event) => setSelectedCategoryId((event.target.value || "ALL")), children: [_jsxs("option", { value: "ALL", children: ["All (", traits.length, ")"] }), traitCategories.map((category) => (_jsx("option", { value: category, children: category }, category)))] })] }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col overflow-hidden", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b border-slate-200/80 p-3", children: [_jsx("input", { type: "search", className: "min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm", placeholder: "Search traits", value: searchInput, onChange: (event) => setSearchInput(event.target.value), "aria-label": "Search traits" }), _jsxs("select", { className: "w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm", value: sortOption, onChange: (event) => setSortOption(event.target.value), "aria-label": "Sort traits", children: [_jsx("option", { value: "alphabetical", children: "Alphabetical" }), hasTimestamp && _jsx("option", { value: "recently_added", children: "Recently added" })] })] }), _jsxs("div", { className: "flex-1 space-y-3 overflow-y-auto bg-slate-50/20 p-3 pb-20", children: [_jsx(TraitSetSection, { sets: contextualSets, traitsById: traitsById, alreadyAddedTraitIds: alreadyAddedTraitIds, selectedTraitIds: selectedTraitIds, previewSetId: previewSetId, onPreviewSet: previewSet, onSelectSet: selectSet, isLoading: isLoadingResults, activeCategory: selectedCategoryId, hasSearch: Boolean(searchQuery.trim()) }), _jsx(TraitResultsList, { traits: filteredTraits, activeCategory: selectedCategoryId, totalTraitsInActiveCategory: categoryTraits.length, searchQuery: searchQuery, alreadyAddedTraitIds: alreadyAddedTraitIds, selectedTraitIds: selectedTraitIds, onToggleTrait: toggleTrait, isLoading: isLoadingResults })] })] }), _jsx(StickySelectionBar, { selectedCount: selectedTraitIds.size, onAdd: () => void commitAdd(), onCancel: onClose, isSubmitting: isSubmitting })] })] }) }));
}

import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { computeProgramStatus, programTraitPriorityBuckets, brandVoiceAvoidFlagOptions, brandVoiceStyleFlagOptions, boardStateToProgramTraitRows, defaultAvoidFlags, defaultStyleFlags, defaultToneProfile, generateBrandVoicePreview, QUIZ_EXPERIENCE_PRESETS, resolveQuizExperienceConfig, traitCategories } from "@pmm/domain";
import { AppShell, Button, Card } from "@pmm/ui";
import { BrandVoicePreview } from "./components/brand-voice/BrandVoicePreview";
import { ChipSelectWithCustom } from "./components/brand-voice/ChipSelectWithCustom";
import { GeneratedSamplesPanel } from "./components/brand-voice/GeneratedSamplesPanel";
import { SimulationLab } from "./components/brand-voice/SimulationLab";
import { ToneSelector } from "./components/brand-voice/ToneSelector";
import { ToneSliders } from "./components/brand-voice/ToneSliders";
import { TraitProgramsAccordion, TraitProgramsPanel } from "./components/trait-detail/TraitProgramsPanel";
import { TraitPickerModal } from "./components/trait-picker/TraitPickerModal";
import { AdminWidgetEmbedPage } from "./components/widget/AdminWidgetEmbedPage";
import { WidgetBrandingPage } from "./components/widget/WidgetBrandingPage";
import { AdminWidgetPreviewPage } from "./components/widget/AdminWidgetPreviewPage";
import { AdminWidgetOrchestrationPage } from "./components/widget/AdminWidgetOrchestrationPage";
import { WidgetDropdown } from "./components/widget/WidgetDropdown";
import { createEmptyProgramBoardState, isBoardDirty, moveTraitInBoard, removeTraitFromBoard, toBoardIdState } from "./program-board-state";
import "./styles.css";
const queryClient = new QueryClient();
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const navLinkClass = "rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-200";
const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600";
const subtleButtonClass = "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50";
const openAiVoiceOptions = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const traitStatusOptions = ["DRAFT", "IN_REVIEW", "ACTIVE", "DEPRECATED"];
const archetypeTagOptions = ["ANALYST", "BUILDER", "STRATEGIST", "OPERATOR", "VISIONARY", "LEADER", "COMMUNICATOR"];
const visualMoodOptions = ["NEUTRAL", "ASPIRATIONAL", "PLAYFUL", "BOLD", "SERIOUS"];
const knownDisplayIconTokens = ["spark", "seedling", "wrench", "target", "crown", "compass", "graph", "bridge"];
const isVisualMoodStylingActive = false;
const canonicalQuizOptions = ["Beginner", "Developing", "Proficient", "Advanced"];
const answerStyleLabel = {
    CARD_GRID: "Card Grid",
    RADIO: "Radio",
    SLIDER: "Slider"
};
const traitStatusRank = {
    ACTIVE: 0,
    IN_REVIEW: 1,
    DRAFT: 2,
    DEPRECATED: 3
};
const traitStatusTone = {
    ACTIVE: "bg-emerald-100 text-emerald-800",
    IN_REVIEW: "bg-amber-100 text-amber-800",
    DRAFT: "bg-slate-200 text-slate-700",
    DEPRECATED: "bg-rose-100 text-rose-700"
};
const traitListStatusMeta = {
    ACTIVE: { label: "Active", dotClassName: "bg-emerald-500", textClassName: "text-emerald-700" },
    DRAFT: { label: "Draft", dotClassName: "bg-slate-400", textClassName: "text-slate-600" },
    ARCHIVED: { label: "Archived", dotClassName: "bg-rose-500", textClassName: "text-rose-700" }
};
const programListStatusMeta = {
    DRAFT: { label: "Draft", dotClassName: "bg-slate-400", textClassName: "text-slate-600" },
    ACTIVE: { label: "Active", dotClassName: "bg-emerald-500", textClassName: "text-emerald-700" },
    INACTIVE: { label: "Inactive", dotClassName: "bg-slate-400", textClassName: "text-slate-600" }
};
class ApiError extends Error {
    code;
    missing;
    details;
}
async function request(path, init) {
    let response;
    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            headers: { "Content-Type": "application/json" },
            ...init
        });
    }
    catch {
        throw new Error(`Unable to reach API at ${apiBaseUrl}. Start the server and retry.`);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorPayload = data?.error;
        if (typeof errorPayload === "string") {
            throw new Error(errorPayload);
        }
        if (errorPayload && typeof errorPayload === "object" && typeof errorPayload.message === "string") {
            const apiError = new ApiError(errorPayload.message);
            if (typeof errorPayload.code === "string") {
                apiError.code = errorPayload.code;
            }
            if (Array.isArray(errorPayload.missing)) {
                apiError.missing = errorPayload.missing.filter((item) => typeof item === "string");
            }
            if ("details" in errorPayload) {
                apiError.details = errorPayload.details;
            }
            throw apiError;
        }
        throw new Error("Request failed");
    }
    return data;
}
function splitListText(value) {
    return value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
}
function joinListText(items) {
    return items.join("\n");
}
function buildDefinitionDraft(name, category) {
    const targetName = name.trim() || "This trait";
    return `${targetName} evaluates a candidate's ${category.toLowerCase().replaceAll("_", " ")} capability through consistent behaviors that indicate preparedness, growth potential, and fit for the program context.`;
}
function buildSignalSuggestions(kind, name) {
    const baseName = name.trim() || "the trait";
    if (kind === "positive") {
        return [
            `Provides concrete examples that demonstrate ${baseName.toLowerCase()}.`,
            `Explains decisions with clear reasoning and tradeoffs.`,
            "Shows reflection on outcomes and specific lessons learned."
        ];
    }
    return [
        `Struggles to provide specific evidence of ${baseName.toLowerCase()}.`,
        "Uses vague or contradictory responses without clear reasoning.",
        "Deflects responsibility and avoids discussing improvement areas."
    ];
}
function buildQuestionPromptDraft(trait, type) {
    const traitName = trait.name.trim() || "this trait";
    const traitCategory = trait.category.toLowerCase().replaceAll("_", " ");
    const definition = (trait.definition ?? "").trim();
    if (type === "quiz") {
        if (definition.length > 0) {
            return `Which response best demonstrates ${traitName.toLowerCase()} based on this definition: ${definition}?`;
        }
        return `Which option best demonstrates strong ${traitName.toLowerCase()} in a ${traitCategory} scenario?`;
    }
    if (definition.length > 0) {
        return `Describe a specific time when you demonstrated ${traitName.toLowerCase()}. How did your approach align with: ${definition}?`;
    }
    return `Describe a specific time when you demonstrated ${traitName.toLowerCase()} in a high-stakes ${traitCategory} situation. What did you do and why?`;
}
function qualityHint(value) {
    const count = value.trim().length;
    if (count >= 220) {
        return { label: "High quality detail", className: "text-emerald-700" };
    }
    if (count >= 100) {
        return { label: "Good depth", className: "text-slate-600" };
    }
    return { label: "Add more detail", className: "text-amber-700" };
}
const emptyTraitForm = {
    name: "",
    category: "ACADEMIC",
    status: "DRAFT",
    definition: "",
    publicLabel: "",
    oneLineHook: "",
    archetypeTag: "ANALYST",
    displayIcon: "spark",
    visualMood: "ASPIRATIONAL",
    experienceDraftJson: "",
    rubricPositiveSignals: "",
    rubricNegativeSignals: "",
    rubricFollowUps: ""
};
function toTraitFormState(trait) {
    return {
        name: trait.name,
        category: trait.category,
        status: trait.status,
        definition: trait.definition ?? "",
        publicLabel: trait.publicLabel ?? "",
        oneLineHook: trait.oneLineHook ?? "",
        archetypeTag: trait.archetypeTag ?? "ANALYST",
        displayIcon: trait.displayIcon ?? "spark",
        visualMood: trait.visualMood ?? "ASPIRATIONAL",
        experienceDraftJson: trait.experienceDraftJson ?? "",
        rubricPositiveSignals: trait.rubricPositiveSignals ?? "",
        rubricNegativeSignals: trait.rubricNegativeSignals ?? "",
        rubricFollowUps: trait.rubricFollowUps ?? ""
    };
}
function normalizeTrait(trait) {
    const status = trait.status ?? "DRAFT";
    const completeness = trait.completeness ??
        computeDraftCompleteness({
            name: trait.name,
            category: trait.category,
            status,
            definition: trait.definition ?? "",
            publicLabel: trait.publicLabel ?? "",
            oneLineHook: trait.oneLineHook ?? "",
            archetypeTag: trait.archetypeTag ?? "ANALYST",
            displayIcon: trait.displayIcon ?? "",
            visualMood: trait.visualMood ?? "ASPIRATIONAL",
            experienceDraftJson: trait.experienceDraftJson ?? "",
            rubricPositiveSignals: trait.rubricPositiveSignals ?? "",
            rubricNegativeSignals: trait.rubricNegativeSignals ?? "",
            rubricFollowUps: trait.rubricFollowUps ?? ""
        }, 0);
    return {
        id: trait.id,
        name: trait.name,
        category: trait.category,
        status,
        definition: trait.definition ?? null,
        publicLabel: trait.publicLabel ?? null,
        oneLineHook: trait.oneLineHook ?? null,
        archetypeTag: trait.archetypeTag ?? null,
        displayIcon: trait.displayIcon ?? null,
        visualMood: trait.visualMood ?? null,
        experienceDraftJson: trait.experienceDraftJson ?? null,
        rubricScaleMin: trait.rubricScaleMin ?? 0,
        rubricScaleMax: trait.rubricScaleMax ?? 5,
        rubricPositiveSignals: trait.rubricPositiveSignals ?? null,
        rubricNegativeSignals: trait.rubricNegativeSignals ?? null,
        rubricFollowUps: trait.rubricFollowUps ?? null,
        completeness,
        programSummary: trait.programSummary
            ? {
                count: Number(trait.programSummary.count ?? 0),
                topPrograms: Array.isArray(trait.programSummary.topPrograms)
                    ? trait.programSummary.topPrograms.map((item) => ({
                        programId: String(item.programId),
                        programName: String(item.programName),
                        bucket: item.bucket,
                        weight: Number(item.weight ?? 0)
                    }))
                    : []
            }
            : undefined,
        createdAt: trait.createdAt ?? new Date().toISOString(),
        updatedAt: trait.updatedAt ?? new Date().toISOString()
    };
}
function normalizeProgram(program) {
    const nowIso = new Date().toISOString();
    return {
        id: program.id,
        name: program.name,
        description: program.description ?? null,
        degreeLevel: program.degreeLevel ?? null,
        department: program.department ?? null,
        isActive: typeof program.isActive === "boolean" ? program.isActive : false,
        createdAt: program.createdAt ?? nowIso,
        updatedAt: program.updatedAt ?? nowIso
    };
}
function normalizeTraitProgramAssociation(item) {
    const nowIso = new Date().toISOString();
    const parsedWeight = Number(item.weight ?? 0);
    const safeWeight = Number.isFinite(parsedWeight) ? Math.max(0, Math.min(1, parsedWeight)) : 0;
    const bucket = programTraitPriorityBuckets.includes(item.bucket)
        ? item.bucket
        : "IMPORTANT";
    return {
        programId: String(item.programId),
        programName: typeof item.programName === "string" && item.programName.trim().length > 0 ? item.programName : "Unknown program",
        bucket,
        weight: safeWeight,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : nowIso
    };
}
function computeDraftCompleteness(input, questionsCount) {
    const positiveCount = splitListText(input.rubricPositiveSignals).length;
    const negativeCount = splitListText(input.rubricNegativeSignals).length;
    const questionCount = Math.max(0, questionsCount);
    const checks = [
        input.name.trim().length > 0,
        Boolean(input.category),
        input.definition.trim().length > 0,
        positiveCount >= 3,
        negativeCount >= 2,
        questionCount >= 1
    ];
    const missing = [];
    if (!checks[0])
        missing.push("Name is required");
    if (!checks[1])
        missing.push("Category is required");
    if (!checks[2])
        missing.push("Definition is required");
    if (!checks[3])
        missing.push("At least 3 positive signals are required");
    if (!checks[4])
        missing.push("At least 2 negative signals are required");
    if (!checks[5])
        missing.push("At least 1 question is required");
    return {
        isComplete: missing.length === 0,
        percentComplete: Math.round((checks.filter(Boolean).length / checks.length) * 100),
        missing,
        counts: {
            positiveSignals: positiveCount,
            negativeSignals: negativeCount,
            questions: questionCount
        }
    };
}
function mapTraitListStatus(status) {
    if (status === "ACTIVE")
        return "ACTIVE";
    if (status === "DEPRECATED")
        return "ARCHIVED";
    return "DRAFT";
}
function mapProgramListStatus(program) {
    return computeProgramStatus(program);
}
function computeListCompletenessRatio(trait) {
    const definitionComplete = (trait.definition ?? "").trim().length > 0;
    const rubricSignalCount = trait.completeness.counts.positiveSignals + trait.completeness.counts.negativeSignals;
    const rubricGeneratedCount = splitListText(trait.rubricFollowUps ?? "").length;
    const rubricComplete = rubricSignalCount > 0 || rubricGeneratedCount > 0;
    const hasQuestion = trait.completeness.counts.questions > 0;
    const passedChecks = [definitionComplete, rubricComplete, hasQuestion].filter(Boolean).length;
    return Math.round((passedChecks / 3) * 100);
}
function FieldMeta({ value }) {
    const hint = qualityHint(value);
    return (_jsxs("div", { className: "mt-1 flex items-center justify-end gap-2 text-xs text-slate-500", children: [_jsxs("span", { children: [value.length, " characters"] }), _jsx("span", { className: hint.className, children: hint.label })] }));
}
function CollapsibleSection({ title, defaultOpen = true, children }) {
    return (_jsxs("details", { open: defaultOpen, className: "rounded-md border border-slate-200 bg-slate-50/50", children: [_jsx("summary", { className: "cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-800", children: title }), _jsx("div", { className: "space-y-3 border-t border-slate-200 bg-white p-3", children: children })] }));
}
function ListBuilder({ label, items, placeholder, onChange, emptyText, addButtonLabel = "Add", suggestionButtonLabel, onSuggestion }) {
    const [draft, setDraft] = useState("");
    const addItem = () => {
        const next = draft.trim();
        if (!next) {
            return;
        }
        onChange([...items, next]);
        setDraft("");
    };
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("label", { className: "text-sm font-semibold text-slate-800", children: label }), suggestionButtonLabel && onSuggestion && (_jsx("button", { type: "button", className: "rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100", onClick: onSuggestion, children: suggestionButtonLabel }))] }), _jsxs("div", { className: "space-y-1.5", children: [items.length === 0 && _jsx("p", { className: "text-xs text-slate-500", children: emptyText }), items.map((item, index) => (_jsxs("div", { className: "flex items-center gap-2 py-1", children: [_jsx("input", { className: "w-full rounded-md border border-slate-200 px-3 py-2 text-sm", value: item, onChange: (event) => {
                                    const next = [...items];
                                    next[index] = event.target.value;
                                    onChange(next);
                                } }), _jsx("button", { type: "button", className: "text-xs text-red-600 hover:text-red-700", onClick: () => onChange(items.filter((_, itemIndex) => itemIndex !== index)), children: "Remove" })] }, `${label}-${index}`))), _jsxs("div", { className: "flex items-center gap-2 pt-1", children: [_jsx("input", { className: "w-full rounded-md border border-slate-200 px-3 py-2 text-sm", placeholder: placeholder, value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addItem();
                                    }
                                } }), _jsx("button", { type: "button", className: "text-sm font-medium text-slate-700 hover:text-slate-900", onClick: addItem, children: addButtonLabel })] })] })] }));
}
function TraitHeader({ name, category, status, isSaving, onSave, onDelete, showDelete }) {
    return (_jsx("header", { className: "sticky top-2 z-10 rounded-md border border-slate-200 bg-white/95 p-4 backdrop-blur", children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "truncate text-2xl font-semibold text-slate-900", children: name.trim() || "New Trait" }), _jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600", children: [_jsx("span", { children: category }), _jsx("span", { "aria-hidden": true, children: "\u00B7" }), _jsxs("span", { className: `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${traitStatusTone[status]}`, children: [_jsx("span", { "aria-hidden": true, className: "h-1.5 w-1.5 rounded-full bg-current opacity-80" }), status.replaceAll("_", " ")] })] })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-3", children: [_jsx(Button, { type: "button", disabled: isSaving, onClick: onSave, children: isSaving ? "Saving..." : "Save Changes" }), showDelete && (_jsx("button", { type: "button", className: "text-sm text-red-600 hover:text-red-700", onClick: onDelete, children: "Delete" }))] })] }) }));
}
function TraitDefinitionSection({ form, setForm, titleInputRef, actionableMissing, showActivationNotice, isEditing, experienceDraft, generatingExperienceDraft, onGenerateExperienceDraft, onApplyExperienceDraft, onDiscardExperienceDraft }) {
    const [showAdvancedWhyPopover, setShowAdvancedWhyPopover] = useState(false);
    const normalizedDisplayIconToken = form.displayIcon.trim().toLowerCase();
    const hasInvalidDisplayIconToken = normalizedDisplayIconToken.length > 0 && !knownDisplayIconTokens.includes(normalizedDisplayIconToken);
    return (_jsxs("section", { className: "space-y-4 rounded-md border border-slate-200 bg-white p-5", children: [_jsx("h2", { className: "text-xl font-semibold text-slate-900", children: "Definition" }), _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, htmlFor: "trait-title-input", children: "Name" }), _jsx("input", { id: "trait-title-input", ref: titleInputRef, required: true, className: inputClass, value: form.name, onChange: (event) => setForm((prev) => ({ ...prev, name: event.target.value })) }), _jsx(FieldMeta, { value: form.name })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Category" }), _jsx("select", { className: inputClass, value: form.category, onChange: (event) => setForm((prev) => ({ ...prev, category: event.target.value })), children: traitCategories.map((category) => (_jsx("option", { value: category, children: category }, category))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, htmlFor: "trait-status-select", children: "Status" }), _jsx("select", { id: "trait-status-select", className: inputClass, value: form.status, onChange: (event) => setForm((prev) => ({ ...prev, status: event.target.value })), children: traitStatusOptions.map((status) => (_jsx("option", { value: status, children: status.replaceAll("_", " ") }, status))) })] }), _jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("label", { className: labelClass, children: "Definition" }), _jsx("button", { type: "button", className: "rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100", onClick: () => setForm((prev) => ({
                                            ...prev,
                                            definition: buildDefinitionDraft(prev.name, prev.category)
                                        })), children: "AI Draft Definition" })] }), _jsx("textarea", { className: inputClass, value: form.definition, onChange: (event) => setForm((prev) => ({ ...prev, definition: event.target.value })) }), _jsx(FieldMeta, { value: form.definition })] })] }), _jsxs("details", { className: "rounded-md border border-slate-200 bg-slate-50/50 p-3", children: [_jsx("summary", { className: "cursor-pointer text-sm font-semibold text-slate-800", children: "Student-Facing Label" }), _jsxs("div", { className: "mt-3 space-y-4", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Used in the quiz UI and results. Does not affect scoring." }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "button", className: subtleButtonClass, disabled: !isEditing || generatingExperienceDraft, onClick: () => onGenerateExperienceDraft("generate"), children: generatingExperienceDraft ? "Generating..." : "Generate with AI" }), _jsx("button", { type: "button", className: subtleButtonClass, disabled: !isEditing || generatingExperienceDraft, onClick: () => onGenerateExperienceDraft("gen_z"), children: "Rewrite for Gen Z" }), _jsx("button", { type: "button", className: subtleButtonClass, disabled: !isEditing || generatingExperienceDraft, onClick: () => onGenerateExperienceDraft("simplify"), children: "Simplify" }), _jsx("button", { type: "button", className: subtleButtonClass, disabled: !isEditing || generatingExperienceDraft, onClick: () => onGenerateExperienceDraft("aspirational"), children: "Make more aspirational" })] }), experienceDraft && (_jsxs("div", { className: "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm", children: [_jsx("p", { className: "font-semibold text-slate-900", children: "AI Draft Ready" }), _jsxs("p", { className: "mt-1 text-xs text-slate-700", children: [experienceDraft.publicLabel || form.name, " \u00B7 ", experienceDraft.archetypeTag, " \u00B7 ", experienceDraft.visualMood] }), _jsx("p", { className: "mt-1 text-xs text-slate-700", children: experienceDraft.oneLineHook }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("button", { type: "button", className: subtleButtonClass, onClick: onApplyExperienceDraft, children: "Apply" }), _jsx("button", { type: "button", className: subtleButtonClass, onClick: onDiscardExperienceDraft, children: "Discard" })] })] })), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Display Name" }), _jsx("input", { className: inputClass, value: form.publicLabel, onChange: (event) => setForm((prev) => ({ ...prev, publicLabel: event.target.value })) }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["Preview label: ", _jsx("span", { className: "font-medium text-slate-700", children: form.publicLabel.trim() || form.name.trim() || "Untitled trait" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Short Description" }), _jsx("textarea", { className: inputClass, value: form.oneLineHook, onChange: (event) => setForm((prev) => ({ ...prev, oneLineHook: event.target.value })) })] }), _jsxs("details", { className: "rounded-md border border-slate-200 bg-white p-3", children: [_jsx("summary", { className: "cursor-pointer text-xs font-semibold tracking-wide text-slate-600", children: "Advanced (Optional - visuals + grouping)" }), _jsxs("div", { className: "mt-3 grid gap-3 md:grid-cols-2", children: [_jsx("div", { className: "md:col-span-2", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Optional controls for result grouping and visuals. Does not affect scoring." }), _jsxs("div", { className: "relative", children: [_jsx("button", { type: "button", className: "text-xs font-medium text-slate-700 underline", onClick: () => setShowAdvancedWhyPopover((prev) => !prev), children: "Why use this?" }), showAdvancedWhyPopover && (_jsx("div", { role: "dialog", className: "absolute right-0 z-10 mt-2 w-72 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-md", children: _jsxs("ul", { className: "list-disc space-y-1 pl-4", children: [_jsx("li", { children: "Archetype: enables a personality-style reveal headline." }), _jsx("li", { children: "Icon: makes choices and results more visual." }), _jsx("li", { children: "Mood: helps traits feel consistent with the quiz theme." })] }) }))] })] }) }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Archetype Tag" }), _jsx("p", { className: "mt-1 text-xs text-slate-600", children: "Groups traits into personality-style results (e.g., Analyst, Builder) for the reveal headline." }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: [_jsx("span", { className: "font-medium text-slate-600", children: "Used in:" }), " Results reveal headline and trait grouping."] }), _jsx("select", { className: inputClass, value: form.archetypeTag, onChange: (event) => setForm((prev) => ({ ...prev, archetypeTag: event.target.value })), children: archetypeTagOptions.map((option) => (_jsx("option", { value: option, children: option }, option))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Display Icon" }), _jsx("p", { className: "mt-1 text-xs text-slate-600", children: "Icon token shown next to this label in answer cards, trait sidebar, and results." }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: [_jsx("span", { className: "font-medium text-slate-600", children: "Used in:" }), " Answer cards, trait sidebar, results."] }), _jsx("input", { className: inputClass, list: "trait-display-icon-tokens", value: form.displayIcon, onChange: (event) => setForm((prev) => ({ ...prev, displayIcon: event.target.value })) }), _jsx("datalist", { id: "trait-display-icon-tokens", children: knownDisplayIconTokens.map((token) => (_jsx("option", { value: token }, token))) }), hasInvalidDisplayIconToken && _jsx("p", { className: "mt-1 text-xs text-red-700", children: "Unknown icon token - choose from the list." })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: `${labelClass} mb-0`, children: "Visual Mood" }), !isVisualMoodStylingActive && _jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600", children: "Future" })] }), isVisualMoodStylingActive ? (_jsx("p", { className: "mt-1 text-xs text-slate-600", children: "Theme hint that can change subtle accents (like gradients) in the quiz UI." })) : (_jsx("p", { className: "mt-1 text-xs text-slate-600", children: "Reserved for future styling - safe to leave blank." })), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: [_jsx("span", { className: "font-medium text-slate-600", children: "Used in:" }), " Optional UI styling (cards and results)."] }), _jsx("select", { className: inputClass, value: form.visualMood, onChange: (event) => setForm((prev) => ({ ...prev, visualMood: event.target.value })), children: visualMoodOptions.map((option) => (_jsx("option", { value: option, children: option }, option))) })] })] })] })] })] }), showActivationNotice && (_jsxs("div", { className: "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900", children: [_jsx("p", { className: "font-medium", children: "This trait won't affect scoring until Active." }), actionableMissing.length > 0 && (_jsx("ul", { className: "mt-2 list-disc space-y-1 pl-5 text-xs", children: actionableMissing.map((item) => (_jsx("li", { children: item }, item))) }))] }))] }));
}
function TraitRubricEditor({ isEditing, lockReason, generatingRubric, onGenerateRubricWithAi, rubricDraft, onApplyRubricDraft, onDiscardRubricDraft, positiveSignals, negativeSignals, followUps, setForm }) {
    const isLocked = lockReason !== "NONE";
    const lockHint = lockReason === "SAVE_REQUIRED" ? "Save Changes to enable" : lockReason === "CREATING_TRAIT" ? "Finish creating the trait to enable" : undefined;
    if (lockReason !== "NONE") {
        return (_jsxs("section", { className: "space-y-4 border-b border-slate-200/80 pb-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900", children: "Scoring Signals" }), _jsx("button", { type: "button", className: "rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60", disabled: true, title: lockHint, children: "Generate with AI" })] }), _jsxs("div", { className: "rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700", children: [lockReason === "CREATING_TRAIT" && "Creating new trait... scoring signals will unlock once creation finishes.", lockReason === "SAVE_REQUIRED" && "Save this trait to enable rubric editing and AI generation.", lockReason === "NO_SELECTION" && "Select a trait to configure scoring signals.", (lockReason === "CREATING_TRAIT" || lockReason === "SAVE_REQUIRED") && (_jsx("p", { className: "mt-2 text-xs text-slate-600", children: "Actions unlock after the trait is ready." }))] })] }));
    }
    return (_jsxs("section", { className: "space-y-4 border-b border-slate-200/80 pb-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900", children: "Scoring Signals" }), isEditing && (_jsx("button", { type: "button", className: "rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60", disabled: generatingRubric || isLocked, title: lockHint, onClick: onGenerateRubricWithAi, children: generatingRubric ? "Generating…" : "Generate with AI" }))] }), !isEditing && _jsx("p", { className: "text-xs text-slate-500", children: "Save the trait first to use \"Generate with AI\"." }), rubricDraft && (_jsxs("div", { className: "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm", children: [_jsx("p", { className: "font-semibold text-slate-900", children: "Draft rubric ready" }), _jsxs("p", { className: "mt-1 text-xs text-slate-700", children: [rubricDraft.positiveSignals.length, " positive \u00B7 ", rubricDraft.negativeSignals.length, " negative \u00B7 ", rubricDraft.followUps.length, " follow-ups"] }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("button", { type: "button", className: subtleButtonClass, onClick: onApplyRubricDraft, children: "Apply" }), _jsx("button", { type: "button", className: subtleButtonClass, onClick: onDiscardRubricDraft, children: "Discard" })] })] })), _jsx(ListBuilder, { label: "Positive Signals", items: positiveSignals, placeholder: "Add a positive signal", emptyText: "No positive signals yet.", addButtonLabel: "+ Add signal", suggestionButtonLabel: "Generate 3 positive signals", onSuggestion: () => setForm((prev) => ({
                    ...prev,
                    rubricPositiveSignals: joinListText(buildSignalSuggestions("positive", prev.name))
                })), onChange: (items) => setForm((prev) => ({ ...prev, rubricPositiveSignals: joinListText(items) })) }), _jsx(ListBuilder, { label: "Negative Signals", items: negativeSignals, placeholder: "Add a negative signal", emptyText: "No negative signals yet.", addButtonLabel: "+ Add signal", suggestionButtonLabel: "Generate 3 negative signals", onSuggestion: () => setForm((prev) => ({
                    ...prev,
                    rubricNegativeSignals: joinListText(buildSignalSuggestions("negative", prev.name))
                })), onChange: (items) => setForm((prev) => ({ ...prev, rubricNegativeSignals: joinListText(items) })) }), _jsx(ListBuilder, { label: "Rubric Follow-Ups", items: followUps, placeholder: "Add an optional follow-up", emptyText: "No follow-up prompts yet.", addButtonLabel: "+ Add follow-up", onChange: (items) => setForm((prev) => ({ ...prev, rubricFollowUps: joinListText(items.slice(0, 2)) })) }), positiveSignals.length === 0 && negativeSignals.length === 0 && (_jsx("p", { className: "text-xs text-slate-500", children: "Add at least 3 positive and 2 negative signals to activate." }))] }));
}
function TraitQuestionsEditor({ selectedTrait, lockReason, generatingQuestionsDraft, onGenerateQuestionsDraftWithAi, onSaveQuizDesign, onSaveChatDesign, questions, rubricFollowUps }) {
    const [tab, setTab] = useState("quiz");
    const [savingQuiz, setSavingQuiz] = useState(false);
    const [savingChat, setSavingChat] = useState(false);
    const [quizDraft, setQuizDraft] = useState(null);
    const [chatDraft, setChatDraft] = useState(null);
    const savedQuizQuestion = useMemo(() => questions.find((question) => question.type === "quiz") ?? null, [questions]);
    const savedChatQuestions = useMemo(() => questions.filter((question) => question.type === "chat").slice(0, 2), [questions]);
    const [quizForm, setQuizForm] = useState({
        narrativeIntro: "",
        questionText: "",
        answerStyle: "CARD_GRID",
        optionMeta: canonicalQuizOptions.map((label, index) => ({
            label,
            microCopy: "",
            iconToken: "",
            traitScore: index + 1
        }))
    });
    const [chatForm, setChatForm] = useState({ chatQuestion1: "", chatQuestion2: "", rubricFollowUps: "" });
    const isLocked = lockReason !== "NONE";
    const lockHint = lockReason === "SAVE_REQUIRED" ? "Save Changes to enable" : lockReason === "CREATING_TRAIT" ? "Finish creating the trait to enable" : undefined;
    const previewQuestionText = quizForm.questionText.trim() || "How would you respond?";
    useEffect(() => {
        const optionMetaFromQuestion = canonicalQuizOptions.map((label, index) => {
            const savedMeta = savedQuizQuestion?.answerOptionsMeta?.find((item) => item.label === label) ?? savedQuizQuestion?.answerOptionsMeta?.[index];
            return {
                label,
                microCopy: savedMeta?.microCopy ?? "",
                iconToken: savedMeta?.iconToken ?? "",
                traitScore: savedMeta?.traitScore ?? index + 1
            };
        });
        setQuizForm({
            narrativeIntro: savedQuizQuestion?.narrativeIntro ?? "",
            questionText: savedQuizQuestion?.prompt ?? "",
            answerStyle: savedQuizQuestion?.answerStyle === "RADIO" || savedQuizQuestion?.answerStyle === "SLIDER" ? savedQuizQuestion.answerStyle : "CARD_GRID",
            optionMeta: optionMetaFromQuestion
        });
        setChatForm({
            chatQuestion1: savedChatQuestions[0]?.prompt ?? "",
            chatQuestion2: savedChatQuestions[1]?.prompt ?? "",
            rubricFollowUps
        });
    }, [savedQuizQuestion, savedChatQuestions, rubricFollowUps]);
    return (_jsxs("section", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900", children: "Interaction Design" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", className: `rounded-md px-2 py-1 text-xs font-medium ${tab === "quiz" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"} disabled:opacity-60`, disabled: isLocked, title: lockHint, onClick: () => setTab("quiz"), children: "Quiz" }), _jsx("button", { type: "button", className: `rounded-md px-2 py-1 text-xs font-medium ${tab === "chat" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"} disabled:opacity-60`, disabled: isLocked, title: lockHint, onClick: () => setTab("chat"), children: "Chat" })] })] }), _jsx("p", { className: "text-sm text-slate-500", children: "Questions elicit evidence. Scoring uses rubric signals." }), lockReason === "CREATING_TRAIT" && (_jsxs("div", { className: "space-y-3 rounded-md border border-slate-200/80 bg-slate-50 p-3", role: "status", "aria-live": "polite", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800", children: "Preparing interview setup" }), _jsx("p", { className: "text-sm text-slate-600", children: "Creating your new trait. Interview questions will appear in a moment." }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "h-10 rounded-md bg-slate-200/70" }), _jsx("div", { className: "h-24 rounded-md bg-slate-200/70" }), _jsx("div", { className: "h-24 rounded-md bg-slate-200/70" })] }), _jsx("p", { className: "text-xs text-slate-600", children: "Actions unlock after the trait is created." })] })), lockReason === "SAVE_REQUIRED" && (_jsxs("div", { className: "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900", children: [_jsx("p", { className: "font-medium", children: "Save this trait to enable question generation and scoring setup." }), _jsx("p", { className: "mt-1 text-xs text-amber-800", children: "Use Save Changes above, then return here to edit quiz/chat questions." })] })), lockReason === "NO_SELECTION" && (_jsxs("div", { className: "rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700", children: [_jsx("p", { className: "font-medium text-slate-800", children: "No trait selected" }), _jsx("p", { className: "mt-1 text-xs text-slate-600", children: "Select a trait to configure scoring and interview questions." })] })), lockReason === "NONE" && tab === "quiz" && (_jsxs("div", { className: "space-y-4 rounded-md border border-slate-200/80 p-3", children: [_jsxs("div", { className: "space-y-3 border-b border-slate-200/80 pb-3", children: [_jsxs("div", { className: "text-xs text-slate-500", children: [_jsx("p", { className: "font-semibold text-slate-700", children: "Current (saved)" }), _jsx("p", { children: savedQuizQuestion?.prompt || "No quiz question saved yet." })] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "button", className: `${subtleButtonClass} whitespace-nowrap px-3 py-2 text-sm`, disabled: generatingQuestionsDraft || isLocked, title: lockHint, onClick: () => void onGenerateQuestionsDraftWithAi().then((draft) => {
                                        setQuizDraft(draft.quiz);
                                    }), children: generatingQuestionsDraft ? "Generating..." : "Generate AI Draft" }) }), quizDraft && (_jsxs("div", { className: "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("p", { className: "font-semibold text-slate-900", children: "Draft values ready" }), _jsx("span", { className: "rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800", children: "Current vs Draft" })] }), _jsxs("div", { className: "mt-2 space-y-3 text-xs text-slate-700", children: [_jsxs("div", { className: "rounded-md border border-blue-100 bg-white/80 p-2", children: [_jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("p", { className: "font-semibold text-slate-800", children: "Narrative Intro" }), quizForm.narrativeIntro.trim() !== quizDraft.narrativeIntro.trim() && (_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800", children: "Changed" }))] }), _jsxs("div", { className: "grid gap-2 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-600", children: "Current" }), _jsx("p", { children: quizForm.narrativeIntro.trim() || "Empty" })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-600", children: "Draft" }), _jsx("p", { children: quizDraft.narrativeIntro.trim() || "Empty" })] })] })] }), _jsxs("div", { className: "rounded-md border border-blue-100 bg-white/80 p-2", children: [_jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("p", { className: "font-semibold text-slate-800", children: "Question Text" }), quizForm.questionText.trim() !== quizDraft.questionText.trim() && (_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800", children: "Changed" }))] }), _jsxs("div", { className: "grid gap-2 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-600", children: "Current" }), _jsx("p", { children: quizForm.questionText.trim() || "Empty" })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-600", children: "Draft" }), _jsx("p", { children: quizDraft.questionText.trim() || "Empty" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "font-semibold text-slate-800", children: "Option Microcopy" }), quizDraft.optionMeta.map((draftItem, index) => {
                                                        const currentItem = quizForm.optionMeta[index] ?? {
                                                            label: draftItem.label,
                                                            microCopy: "",
                                                            iconToken: "",
                                                            traitScore: 0
                                                        };
                                                        const hasChanged = currentItem.microCopy.trim() !== draftItem.microCopy.trim() ||
                                                            currentItem.iconToken.trim() !== draftItem.iconToken.trim() ||
                                                            currentItem.traitScore !== draftItem.traitScore;
                                                        return (_jsxs("div", { className: `rounded-md border p-2 ${hasChanged ? "border-amber-300 bg-amber-50/60" : "border-blue-100 bg-white/80"}`, children: [_jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("p", { className: "font-semibold text-slate-800", children: draftItem.label }), hasChanged && (_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800", children: "Changed" }))] }), _jsxs("div", { className: "grid gap-2 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-600", children: "Current" }), _jsxs("p", { children: ["Microcopy: ", currentItem.microCopy.trim() || "Empty"] }), _jsxs("p", { children: ["Icon: ", currentItem.iconToken.trim() || "None"] }), _jsxs("p", { children: ["Score: ", currentItem.traitScore] })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-600", children: "Draft" }), _jsxs("p", { children: ["Microcopy: ", draftItem.microCopy.trim() || "Empty"] }), _jsxs("p", { children: ["Icon: ", draftItem.iconToken.trim() || "None"] }), _jsxs("p", { children: ["Score: ", draftItem.traitScore] })] })] })] }, `quiz-draft-meta-${draftItem.label}-${index}`));
                                                    })] })] }), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsx("button", { type: "button", className: subtleButtonClass, disabled: isLocked, title: lockHint, onClick: () => {
                                                    void onSaveQuizDesign(quizDraft);
                                                    setQuizDraft(null);
                                                }, children: "Apply" }), _jsx("button", { type: "button", className: subtleButtonClass, disabled: isLocked, title: lockHint, onClick: () => setQuizDraft(null), children: "Discard" })] })] }))] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Narrative Intro (optional)" }), _jsx("textarea", { className: inputClass, disabled: isLocked, value: quizForm.narrativeIntro, onChange: (event) => setQuizForm((prev) => ({ ...prev, narrativeIntro: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Question Text" }), _jsx("textarea", { className: inputClass, disabled: isLocked, value: quizForm.questionText, onChange: (event) => setQuizForm((prev) => ({ ...prev, questionText: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Answer Style" }), _jsxs("select", { className: inputClass, disabled: isLocked, value: quizForm.answerStyle, onChange: (event) => setQuizForm((prev) => ({ ...prev, answerStyle: event.target.value })), children: [_jsx("option", { value: "CARD_GRID", children: answerStyleLabel.CARD_GRID }), _jsx("option", { value: "RADIO", children: answerStyleLabel.RADIO }), _jsx("option", { value: "SLIDER", children: answerStyleLabel.SLIDER })] })] }), _jsxs("div", { className: "rounded-md border border-slate-200 bg-slate-50 p-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Answer Style Preview" }), _jsx("span", { className: "text-xs font-medium text-slate-600", children: answerStyleLabel[quizForm.answerStyle] })] }), _jsx("p", { className: "mt-2 text-sm font-medium text-slate-900", children: previewQuestionText }), quizForm.answerStyle === "CARD_GRID" && (_jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: quizForm.optionMeta.map((meta) => (_jsxs("div", { className: "rounded-md border border-slate-200 bg-white p-2", children: [_jsx("p", { className: "text-sm font-semibold text-slate-900", children: meta.label }), _jsx("p", { className: "mt-1 text-xs text-slate-600", children: meta.microCopy.trim() || "Short support microcopy appears here." })] }, `quiz-preview-card-${meta.label}`))) })), quizForm.answerStyle === "RADIO" && (_jsx("div", { className: "mt-3 space-y-2", children: quizForm.optionMeta.map((meta, index) => (_jsxs("label", { className: "flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800", children: [_jsx("input", { type: "radio", name: "answer-style-preview-radio", disabled: true, checked: index === 0, readOnly: true }), _jsx("span", { children: meta.label })] }, `quiz-preview-radio-${meta.label}`))) })), quizForm.answerStyle === "SLIDER" && (_jsxs("div", { className: "mt-3 space-y-2 rounded-md border border-slate-200 bg-white p-3", children: [_jsx("input", { type: "range", min: 1, max: quizForm.optionMeta.length, value: Math.ceil(quizForm.optionMeta.length / 2), disabled: true, readOnly: true, className: "w-full" }), _jsx("div", { className: "grid grid-cols-4 gap-2 text-center text-xs text-slate-600", children: quizForm.optionMeta.map((meta) => (_jsx("span", { children: meta.label }, `quiz-preview-slider-${meta.label}`))) })] }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Option Microcopy (display-only)" }), quizForm.optionMeta.map((meta, index) => (_jsxs("div", { className: "grid gap-2 md:grid-cols-4", children: [_jsx("input", { className: inputClass, value: meta.label, readOnly: true, disabled: isLocked }), _jsx("input", { className: inputClass, disabled: isLocked, placeholder: "Microcopy", value: meta.microCopy, onChange: (event) => setQuizForm((prev) => ({
                                            ...prev,
                                            optionMeta: prev.optionMeta.map((item, itemIndex) => (itemIndex === index ? { ...item, microCopy: event.target.value } : item))
                                        })) }), _jsx("input", { className: inputClass, disabled: isLocked, placeholder: "Icon token", value: meta.iconToken, onChange: (event) => setQuizForm((prev) => ({
                                            ...prev,
                                            optionMeta: prev.optionMeta.map((item, itemIndex) => (itemIndex === index ? { ...item, iconToken: event.target.value } : item))
                                        })) }), _jsx("input", { className: inputClass, disabled: isLocked, type: "number", min: 0, max: 5, value: meta.traitScore, onChange: (event) => setQuizForm((prev) => ({
                                            ...prev,
                                            optionMeta: prev.optionMeta.map((item, itemIndex) => (itemIndex === index ? { ...item, traitScore: Number(event.target.value || 0) } : item))
                                        })) })] }, `quiz-meta-${meta.label}-${index}`)))] }), _jsx("div", { className: "flex justify-end border-t border-slate-200/80 pt-3", children: _jsx(Button, { type: "button", className: "whitespace-nowrap px-4 py-2 text-sm", disabled: savingQuiz || isLocked, title: lockHint, onClick: async () => {
                                setSavingQuiz(true);
                                try {
                                    await onSaveQuizDesign(quizForm);
                                }
                                finally {
                                    setSavingQuiz(false);
                                }
                            }, children: savingQuiz ? "Saving..." : "Save Quiz Design" }) })] })), lockReason === "NONE" && tab === "chat" && (_jsxs("div", { className: "space-y-4 rounded-md border border-slate-200/80 p-3", children: [_jsxs("div", { className: "text-xs text-slate-500", children: [_jsx("p", { className: "font-semibold text-slate-700", children: "Current (saved)" }), _jsx("p", { children: savedChatQuestions[0]?.prompt || "No chat questions saved yet." }), savedChatQuestions[1]?.prompt && _jsx("p", { children: savedChatQuestions[1]?.prompt })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Chat Question 1" }), _jsx("textarea", { className: inputClass, disabled: isLocked, value: chatForm.chatQuestion1, onChange: (event) => setChatForm((prev) => ({ ...prev, chatQuestion1: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Chat Question 2" }), _jsx("textarea", { className: inputClass, disabled: isLocked, value: chatForm.chatQuestion2, onChange: (event) => setChatForm((prev) => ({ ...prev, chatQuestion2: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Rubric Follow-Ups (0-2 lines)" }), _jsx("textarea", { className: inputClass, disabled: isLocked, value: chatForm.rubricFollowUps, onChange: (event) => setChatForm((prev) => ({ ...prev, rubricFollowUps: event.target.value })) })] }), _jsx("div", { className: "rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700", children: "Chat scoring uses rubric signals (3 positive, 3 negative) to derive a 0-5 score." }), chatDraft && (_jsxs("div", { className: "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm", children: [_jsx("p", { className: "font-semibold text-slate-900", children: "Draft values ready" }), _jsx("p", { className: "mt-1 text-xs text-slate-700", children: chatDraft.chatQuestion1 }), _jsx("p", { className: "mt-1 text-xs text-slate-700", children: chatDraft.chatQuestion2 }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("button", { type: "button", className: subtleButtonClass, disabled: isLocked, title: lockHint, onClick: () => {
                                            void onSaveChatDesign(chatDraft);
                                            setChatDraft(null);
                                        }, children: "Apply" }), _jsx("button", { type: "button", className: subtleButtonClass, disabled: isLocked, title: lockHint, onClick: () => setChatDraft(null), children: "Discard" })] })] })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", className: subtleButtonClass, disabled: generatingQuestionsDraft || isLocked, title: lockHint, onClick: () => void onGenerateQuestionsDraftWithAi().then((draft) => {
                                    setChatDraft(draft.chat);
                                }), children: generatingQuestionsDraft ? "Generating..." : "Generate AI Draft" }), _jsx(Button, { type: "button", disabled: savingChat || isLocked, title: lockHint, onClick: async () => {
                                    setSavingChat(true);
                                    try {
                                        await onSaveChatDesign(chatForm);
                                    }
                                    finally {
                                        setSavingChat(false);
                                    }
                                }, children: savingChat ? "Saving..." : "Save Chat Design" })] })] }))] }));
}
function TraitScoringInterviewSection({ children, lockReason }) {
    return (_jsxs("section", { className: "space-y-6 rounded-md border border-slate-200 bg-white p-5", children: [_jsx("h2", { className: "text-xl font-semibold text-slate-900", children: "Scoring & Interview" }), lockReason !== "NONE" && (_jsxs("div", { className: "rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700", children: [lockReason === "CREATING_TRAIT" && "Creating new trait... interview settings are temporarily locked.", lockReason === "SAVE_REQUIRED" && "Save this trait to enable question generation and scoring setup.", lockReason === "NO_SELECTION" && "Select a trait to configure scoring and interview questions."] })), children] }));
}
function TraitProgramsSidebar({ selectedTrait, selectedTraitPrograms, selectedTraitProgramsLoading, selectedTraitProgramsError, onManage, onProgramClick }) {
    if (!selectedTrait) {
        return null;
    }
    return (_jsx("aside", { className: "hidden w-full min-w-[240px] max-w-[340px] self-start overflow-auto lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]", "aria-label": "Used in programs", children: _jsx(TraitProgramsPanel, { programs: selectedTraitPrograms, loading: selectedTraitProgramsLoading, error: selectedTraitProgramsError, onManage: onManage, onProgramClick: onProgramClick }) }));
}
function ShellLayout({ children }) {
    return (_jsxs(AppShell, { children: [_jsx("header", { className: "border-b border-slate-200 bg-white", children: _jsxs("div", { className: "mx-auto flex max-w-7xl items-center justify-between p-4", children: [_jsx("h1", { className: "text-xl font-semibold", children: "Program Match Admin" }), _jsxs("nav", { className: "flex items-center gap-2", children: [_jsx(Link, { className: navLinkClass, to: "/traits", children: "Traits" }), _jsx(Link, { className: navLinkClass, to: "/programs", children: "Programs" }), _jsx(Link, { className: navLinkClass, to: "/brand-voice", children: "Brand Voice" }), _jsx(Link, { className: navLinkClass, to: "/quiz-experience", children: "Quiz Experience" }), _jsx(WidgetDropdown, {})] })] }) }), _jsx("main", { className: "mx-auto max-w-7xl p-4", children: children })] }));
}
export function TraitsPage() {
    const navigate = useNavigate();
    const [traits, setTraits] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [selectedTraitId, setSelectedTraitId] = useState(null);
    const [form, setForm] = useState({ ...emptyTraitForm });
    const [baselineForm, setBaselineForm] = useState({ ...emptyTraitForm });
    const [experienceDraft, setExperienceDraft] = useState(null);
    const [generatingExperienceDraft, setGeneratingExperienceDraft] = useState(false);
    const [traitNotice, setTraitNotice] = useState(null);
    const [traitError, setTraitError] = useState(null);
    const [activationMissing, setActivationMissing] = useState([]);
    const [rubricDraft, setRubricDraft] = useState(null);
    const [generatingRubric, setGeneratingRubric] = useState(false);
    const [generatingQuestionsDraft, setGeneratingQuestionsDraft] = useState(false);
    const [programDrawerTraitId, setProgramDrawerTraitId] = useState(null);
    const [selectedTraitPrograms, setSelectedTraitPrograms] = useState([]);
    const [selectedTraitProgramsLoading, setSelectedTraitProgramsLoading] = useState(false);
    const [selectedTraitProgramsError, setSelectedTraitProgramsError] = useState(null);
    const [isCreatingDraft, setIsCreatingDraft] = useState(false);
    const [editorSaveStatus, setEditorSaveStatus] = useState("idle");
    const titleInputRef = useRef(null);
    const focusTitleOnSelectRef = useRef(false);
    const createDraftRequestIdRef = useRef(0);
    const isMountedRef = useRef(true);
    const positiveSignals = useMemo(() => splitListText(form.rubricPositiveSignals), [form.rubricPositiveSignals]);
    const negativeSignals = useMemo(() => splitListText(form.rubricNegativeSignals), [form.rubricNegativeSignals]);
    const followUps = useMemo(() => splitListText(form.rubricFollowUps), [form.rubricFollowUps]);
    const traitFormDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baselineForm), [form, baselineForm]);
    const draftCompleteness = useMemo(() => computeDraftCompleteness(form, questions.length), [form, questions.length]);
    const selectedTrait = traits.find((trait) => trait.id === selectedTraitId) ?? null;
    const isEditing = Boolean(selectedTraitId && selectedTrait);
    const sortedTraits = useMemo(() => [...traits].sort((a, b) => {
        const statusDiff = traitStatusRank[a.status] - traitStatusRank[b.status];
        if (statusDiff !== 0)
            return statusDiff;
        return a.name.localeCompare(b.name);
    }), [traits]);
    const loadTraits = async () => {
        setLoading(true);
        setTraitError(null);
        try {
            const query = new URLSearchParams();
            if (search.trim()) {
                query.set("q", search.trim());
            }
            if (categoryFilter !== "ALL") {
                query.set("category", categoryFilter);
            }
            query.set("include", "programSummary");
            const payload = await request(`/api/admin/traits?${query.toString()}`);
            setTraits(payload.data.map((trait) => normalizeTrait(trait)));
            if (payload.data.length === 0) {
                setSelectedTraitId(null);
            }
            else if (selectedTraitId && !payload.data.some((trait) => trait.id === selectedTraitId)) {
                setSelectedTraitId(payload.data[0]?.id ?? null);
            }
        }
        catch (error) {
            setTraitError(error instanceof Error ? error.message : "Failed to load traits.");
        }
        finally {
            setLoading(false);
        }
    };
    const loadQuestions = async (traitId) => {
        const payload = await request(`/api/admin/traits/${traitId}/questions`);
        setQuestions(payload.data);
    };
    const loadTraitPrograms = async (traitId) => {
        setSelectedTraitProgramsLoading(true);
        setSelectedTraitProgramsError(null);
        try {
            const payload = await request(`/api/admin/traits/${traitId}/programs`);
            setSelectedTraitPrograms(payload.data.map((item) => normalizeTraitProgramAssociation(item)));
        }
        catch (error) {
            setSelectedTraitPrograms([]);
            setSelectedTraitProgramsError(error instanceof Error ? error.message : "Failed to load associated programs.");
        }
        finally {
            setSelectedTraitProgramsLoading(false);
        }
    };
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    useEffect(() => {
        void loadTraits();
    }, [search, categoryFilter]);
    useEffect(() => {
        if (!selectedTraitId) {
            setQuestions([]);
            setSelectedTraitPrograms([]);
            setSelectedTraitProgramsError(null);
            setSelectedTraitProgramsLoading(false);
            return;
        }
        void loadQuestions(selectedTraitId).catch((error) => {
            setTraitError(error instanceof Error ? error.message : "Failed to load questions.");
        });
        void loadTraitPrograms(selectedTraitId);
    }, [selectedTraitId]);
    useEffect(() => {
        if (!selectedTraitId || !focusTitleOnSelectRef.current)
            return;
        focusTitleOnSelectRef.current = false;
        window.setTimeout(() => {
            titleInputRef.current?.focus();
            titleInputRef.current?.select();
        }, 0);
    }, [selectedTraitId]);
    const canLeaveTraitForm = () => {
        if (!traitFormDirty) {
            return true;
        }
        return window.confirm("You have unsaved trait changes. Discard them and continue?");
    };
    const startCreateTrait = async () => {
        if (isCreatingDraft)
            return;
        if (!canLeaveTraitForm()) {
            return;
        }
        const previousSelectedTraitId = selectedTraitId;
        const previousForm = form;
        const previousBaselineForm = baselineForm;
        const previousExperienceDraft = experienceDraft;
        const previousRubricDraft = rubricDraft;
        const previousActivationMissing = activationMissing;
        const requestId = createDraftRequestIdRef.current + 1;
        createDraftRequestIdRef.current = requestId;
        setIsCreatingDraft(true);
        setEditorSaveStatus("idle");
        setSelectedTraitId(null);
        setForm({ ...emptyTraitForm });
        setBaselineForm({ ...emptyTraitForm });
        setExperienceDraft(null);
        setRubricDraft(null);
        setActivationMissing([]);
        setTraitNotice(null);
        setTraitError(null);
        try {
            const created = await request("/api/admin/traits", {
                method: "POST",
                body: JSON.stringify({
                    name: "Untitled trait",
                    category: emptyTraitForm.category,
                    status: "DRAFT"
                })
            });
            if (!isMountedRef.current || createDraftRequestIdRef.current !== requestId) {
                return;
            }
            const normalized = normalizeTrait(created.data);
            const nextForm = toTraitFormState(normalized);
            setTraits((prev) => [normalized, ...prev.filter((item) => item.id !== normalized.id)]);
            setSelectedTraitId(normalized.id);
            setForm(nextForm);
            setBaselineForm(nextForm);
            setTraitNotice("Saved");
            focusTitleOnSelectRef.current = true;
            await loadTraits();
            await loadQuestions(normalized.id);
        }
        catch (error) {
            if (!isMountedRef.current || createDraftRequestIdRef.current !== requestId) {
                return;
            }
            if (previousSelectedTraitId) {
                setSelectedTraitId(previousSelectedTraitId);
                setForm(previousForm);
                setBaselineForm(previousBaselineForm);
                setExperienceDraft(previousExperienceDraft);
                setRubricDraft(previousRubricDraft);
                setActivationMissing(previousActivationMissing);
            }
            setTraitError(error instanceof Error ? error.message : "Could not create draft trait.");
        }
        finally {
            if (isMountedRef.current && createDraftRequestIdRef.current === requestId) {
                setIsCreatingDraft(false);
            }
        }
    };
    const startEditTrait = (trait) => {
        if (selectedTraitId === trait.id) {
            return;
        }
        if (!canLeaveTraitForm()) {
            return;
        }
        const nextForm = toTraitFormState(trait);
        setSelectedTraitId(trait.id);
        setForm(nextForm);
        setBaselineForm(nextForm);
        setTraitNotice(null);
        setTraitError(null);
        setExperienceDraft(null);
        setActivationMissing([]);
        setEditorSaveStatus("idle");
    };
    const submitTrait = async (event) => {
        event?.preventDefault();
        setTraitError(null);
        setTraitNotice(null);
        setActivationMissing([]);
        setEditorSaveStatus("saving");
        try {
            const body = {
                ...form,
                rubricScaleMin: 0,
                rubricScaleMax: 5
            };
            if (selectedTraitId) {
                const updated = await request(`/api/admin/traits/${selectedTraitId}`, {
                    method: "PUT",
                    body: JSON.stringify(body)
                });
                const nextForm = toTraitFormState(updated.data);
                setForm(nextForm);
                setBaselineForm(nextForm);
                setTraitNotice("Saved");
            }
            else {
                const created = await request("/api/admin/traits", {
                    method: "POST",
                    body: JSON.stringify(body)
                });
                const nextForm = toTraitFormState(created.data);
                setSelectedTraitId(created.data.id);
                setForm(nextForm);
                setBaselineForm(nextForm);
                setTraitNotice("Saved");
            }
            setEditorSaveStatus("saved");
            await loadTraits();
            if (selectedTraitId) {
                await loadQuestions(selectedTraitId);
            }
        }
        catch (error) {
            if (error instanceof ApiError && error.code === "TRAIT_INCOMPLETE") {
                setTraitError("Trait incomplete");
                setActivationMissing(error.missing ?? []);
                setForm((prev) => ({ ...prev, status: baselineForm.status }));
                setEditorSaveStatus("error");
            }
            else {
                setTraitError(error instanceof Error ? error.message : "Failed to save trait.");
                setEditorSaveStatus("error");
            }
        }
    };
    const deleteTrait = async (id) => {
        await request(`/api/admin/traits/${id}`, { method: "DELETE" });
        if (selectedTraitId === id) {
            setSelectedTraitId(null);
            setForm({ ...emptyTraitForm });
            setBaselineForm({ ...emptyTraitForm });
        }
        await loadTraits();
    };
    const upsertQuestion = async (existingQuestionId, body) => {
        if (!selectedTraitId)
            return;
        if (existingQuestionId) {
            await request(`/api/admin/questions/${existingQuestionId}`, {
                method: "PUT",
                body: JSON.stringify(body)
            });
            return;
        }
        await request(`/api/admin/traits/${selectedTraitId}/questions`, {
            method: "POST",
            body: JSON.stringify(body)
        });
    };
    const generateRubricWithAi = async () => {
        if (!selectedTraitId) {
            return;
        }
        setGeneratingRubric(true);
        setTraitError(null);
        try {
            const payload = await request(`/api/admin/traits/${selectedTraitId}/generate-signals`, { method: "POST" });
            const { positiveSignals: pos, negativeSignals: neg, followUps: follow } = payload.data;
            setRubricDraft({
                positiveSignals: (pos ?? []).slice(0, 3),
                negativeSignals: (neg ?? []).slice(0, 3),
                followUps: (follow ?? []).slice(0, 2)
            });
        }
        catch (error) {
            setTraitError(error instanceof Error ? error.message : "Failed to generate rubric with AI.");
        }
        finally {
            setGeneratingRubric(false);
        }
    };
    const applyRubricDraft = () => {
        if (!rubricDraft)
            return;
        setForm((prev) => ({
            ...prev,
            rubricPositiveSignals: joinListText(rubricDraft.positiveSignals),
            rubricNegativeSignals: joinListText(rubricDraft.negativeSignals),
            rubricFollowUps: joinListText(rubricDraft.followUps)
        }));
        setRubricDraft(null);
    };
    const discardRubricDraft = () => setRubricDraft(null);
    const generateQuestionsDraftWithAi = async () => {
        if (!selectedTraitId) {
            throw new Error("Select a trait first.");
        }
        setGeneratingQuestionsDraft(true);
        setTraitError(null);
        try {
            const payload = await request(`/api/admin/traits/${selectedTraitId}/generate-questions`, { method: "POST" });
            const quizDraftMeta = canonicalQuizOptions.map((label, index) => ({
                label,
                microCopy: index === 0 ? "Just getting started" : index === 1 ? "Building consistency" : index === 2 ? "Strong in practice" : "Clear standout",
                iconToken: ["seedling", "wrench", "target", "crown"][index] ?? "spark",
                traitScore: index + 1
            }));
            return {
                quiz: {
                    narrativeIntro: selectedTrait?.definition ?? "",
                    questionText: payload.data.quizPrompt,
                    answerStyle: "CARD_GRID",
                    optionMeta: quizDraftMeta
                },
                chat: {
                    chatQuestion1: payload.data.chatPrompt,
                    chatQuestion2: `Tell me about another example where you showed ${selectedTrait?.name.toLowerCase() ?? "this trait"}.`,
                    rubricFollowUps: form.rubricFollowUps
                }
            };
        }
        catch (error) {
            setTraitError(error instanceof Error ? error.message : "Failed to generate questions with AI.");
            throw error;
        }
        finally {
            setGeneratingQuestionsDraft(false);
        }
    };
    const saveQuizDesign = async (input) => {
        if (!selectedTraitId)
            return;
        const existingQuiz = questions.find((question) => question.type === "quiz") ?? null;
        await upsertQuestion(existingQuiz?.id ?? null, {
            prompt: input.questionText,
            questionText: input.questionText,
            narrativeIntro: input.narrativeIntro || null,
            answerStyle: input.answerStyle,
            answerOptionsMeta: input.optionMeta,
            type: "quiz",
            options: canonicalQuizOptions
        });
        await loadQuestions(selectedTraitId);
        setTraitNotice("Saved");
    };
    const saveChatDesign = async (input) => {
        if (!selectedTraitId)
            return;
        const existingChat = questions.filter((question) => question.type === "chat").slice(0, 2);
        await upsertQuestion(existingChat[0]?.id ?? null, {
            prompt: input.chatQuestion1,
            questionText: input.chatQuestion1,
            answerStyle: "CHAT",
            type: "chat"
        });
        await upsertQuestion(existingChat[1]?.id ?? null, {
            prompt: input.chatQuestion2,
            questionText: input.chatQuestion2,
            answerStyle: "CHAT",
            type: "chat"
        });
        setForm((prev) => ({ ...prev, rubricFollowUps: input.rubricFollowUps }));
        await loadQuestions(selectedTraitId);
        setTraitNotice("Saved");
    };
    const generateExperienceDraftWithAi = async (action) => {
        if (!selectedTraitId)
            return;
        setGeneratingExperienceDraft(true);
        setTraitError(null);
        try {
            const payload = await request(`/api/admin/traits/${selectedTraitId}/experience-draft`, {
                method: "POST",
                body: JSON.stringify({ action })
            });
            setExperienceDraft(payload.data);
        }
        catch (error) {
            setTraitError(error instanceof Error ? error.message : "Failed to generate experience draft with AI.");
        }
        finally {
            setGeneratingExperienceDraft(false);
        }
    };
    const applyExperienceDraft = () => {
        if (!experienceDraft)
            return;
        setForm((prev) => ({
            ...prev,
            publicLabel: experienceDraft.publicLabel,
            oneLineHook: experienceDraft.oneLineHook,
            archetypeTag: experienceDraft.archetypeTag,
            displayIcon: experienceDraft.displayIcon,
            visualMood: experienceDraft.visualMood
        }));
        setExperienceDraft(null);
    };
    const discardExperienceDraft = () => setExperienceDraft(null);
    const actionableMissing = Array.from(new Set(activationMissing.length > 0 ? activationMissing : draftCompleteness.missing));
    const showActivationNotice = form.status !== "ACTIVE" || actionableMissing.length > 0;
    const interactionLockReason = isCreatingDraft ? "CREATING_TRAIT" : !selectedTrait ? "NO_SELECTION" : traitFormDirty ? "SAVE_REQUIRED" : "NONE";
    return (_jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px_1fr]", children: [_jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-lg font-semibold", children: "Traits Library" }), _jsxs("div", { className: "space-y-2", children: [_jsx("button", { type: "button", className: `${subtleButtonClass} w-full disabled:cursor-not-allowed disabled:opacity-60`, onClick: startCreateTrait, disabled: isCreatingDraft, "aria-busy": isCreatingDraft ? "true" : undefined, children: isCreatingDraft ? "Saving..." : "+ New Trait" }), _jsx("input", { className: inputClass, placeholder: "Search traits...", value: search, onChange: (event) => setSearch(event.target.value) }), _jsxs("select", { className: inputClass, value: categoryFilter, onChange: (event) => setCategoryFilter(event.target.value), children: [_jsx("option", { value: "ALL", children: "All categories" }), traitCategories.map((category) => (_jsx("option", { value: category, children: category }, category)))] })] }), _jsxs("div", { className: "mt-4 space-y-2", children: [loading && _jsx("p", { className: "text-sm text-slate-500", children: "Loading..." }), !loading && sortedTraits.length === 0 && (_jsx("p", { className: "text-sm text-slate-500", children: search.trim() || categoryFilter !== "ALL"
                                    ? "No traits match your search or category filter."
                                    : "No traits yet. Create your first trait." })), sortedTraits.map((trait) => (_jsx(TraitLibraryRow, { trait: trait, loading: loading, selected: selectedTraitId === trait.id, onSelect: () => startEditTrait(trait), onOpenPrograms: () => setProgramDrawerTraitId(trait.id) }, trait.id)))] })] }), _jsxs("div", { className: "flex flex-col gap-6", children: [selectedTrait && (_jsx("div", { className: "lg:hidden", children: _jsx(TraitProgramsAccordion, { programs: selectedTraitPrograms, loading: selectedTraitProgramsLoading, error: selectedTraitProgramsError, onManage: () => setProgramDrawerTraitId(selectedTrait.id), onProgramClick: (programId) => {
                                window.sessionStorage.setItem("pmm:selectedProgramId", programId);
                                navigate("/programs");
                            } }) })), _jsxs("div", { className: "grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]", children: [_jsx("div", { className: "min-w-0", children: _jsxs("div", { className: "space-y-6", children: [_jsx(TraitHeader, { name: form.name, category: form.category, status: form.status, isSaving: editorSaveStatus === "saving", onSave: () => void submitTrait(), onDelete: () => selectedTrait && void deleteTrait(selectedTrait.id), showDelete: Boolean(selectedTrait) }), _jsx(TraitDefinitionSection, { form: form, setForm: setForm, titleInputRef: titleInputRef, actionableMissing: actionableMissing, showActivationNotice: showActivationNotice, isEditing: isEditing, experienceDraft: experienceDraft, generatingExperienceDraft: generatingExperienceDraft, onGenerateExperienceDraft: (action) => void generateExperienceDraftWithAi(action), onApplyExperienceDraft: applyExperienceDraft, onDiscardExperienceDraft: discardExperienceDraft }), _jsxs(TraitScoringInterviewSection, { lockReason: interactionLockReason, children: [_jsx(TraitRubricEditor, { isEditing: isEditing, lockReason: interactionLockReason, generatingRubric: generatingRubric, onGenerateRubricWithAi: () => void generateRubricWithAi(), rubricDraft: rubricDraft, onApplyRubricDraft: applyRubricDraft, onDiscardRubricDraft: discardRubricDraft, positiveSignals: positiveSignals, negativeSignals: negativeSignals, followUps: followUps, setForm: setForm }), _jsx(TraitQuestionsEditor, { selectedTrait: selectedTrait, lockReason: interactionLockReason, generatingQuestionsDraft: generatingQuestionsDraft, onGenerateQuestionsDraftWithAi: generateQuestionsDraftWithAi, onSaveQuizDesign: saveQuizDesign, onSaveChatDesign: saveChatDesign, questions: questions, rubricFollowUps: form.rubricFollowUps })] }), traitNotice && _jsx("p", { className: "text-sm text-emerald-700", children: traitNotice }), traitError && _jsx("p", { className: "text-sm text-red-700", children: traitError })] }) }), _jsx(TraitProgramsSidebar, { selectedTrait: selectedTrait, selectedTraitPrograms: selectedTraitPrograms, selectedTraitProgramsLoading: selectedTraitProgramsLoading, selectedTraitProgramsError: selectedTraitProgramsError, onManage: () => selectedTrait && setProgramDrawerTraitId(selectedTrait.id), onProgramClick: (programId) => {
                                    window.sessionStorage.setItem("pmm:selectedProgramId", programId);
                                    navigate("/programs");
                                } })] })] }), _jsx(TraitProgramsDrawer, { open: programDrawerTraitId !== null, trait: traits.find((trait) => trait.id === programDrawerTraitId) ?? null, onClose: () => setProgramDrawerTraitId(null), onProgramOpen: (programId) => {
                    window.sessionStorage.setItem("pmm:selectedProgramId", programId);
                    navigate("/programs");
                }, onAssociationsChanged: () => {
                    void loadTraits();
                    if (selectedTraitId === programDrawerTraitId && programDrawerTraitId) {
                        void loadTraitPrograms(programDrawerTraitId);
                    }
                } })] }));
}
function TraitLibraryRow({ trait, selected, onSelect, loading, onOpenPrograms }) {
    const status = mapTraitListStatus(trait.status);
    const statusMeta = traitListStatusMeta[status];
    const programCount = trait.programSummary?.count ?? 0;
    return (_jsx("div", { role: "button", tabIndex: 0, onClick: onSelect, onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
            }
        }, "data-testid": `trait-row-${trait.id}`, "aria-current": selected ? "true" : undefined, className: `group relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700 ${selected ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50"}`, children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate font-semibold text-slate-900", children: trait.name }), _jsx("div", { className: "mt-0.5 truncate text-xs text-slate-500", children: trait.category }), !loading && (_jsx("button", { type: "button", className: "mt-1 text-xs font-medium text-slate-600 hover:text-slate-900", onClick: (event) => {
                                event.stopPropagation();
                                onOpenPrograms();
                            }, children: programCount === 0 ? "Not linked" : `${programCount} program${programCount === 1 ? "" : "s"}` })), loading && _jsx("span", { className: "mt-1 inline-block h-4 w-24 animate-pulse rounded bg-slate-200" })] }), _jsxs("div", { className: `mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${statusMeta.textClassName}`, children: [_jsx("span", { "aria-hidden": "true", className: `h-1.5 w-1.5 rounded-full ${statusMeta.dotClassName}` }), _jsx("span", { children: statusMeta.label })] })] }) }));
}
function TraitProgramsDrawer({ open, trait, onClose, onProgramOpen, onAssociationsChanged }) {
    const [associations, setAssociations] = useState([]);
    const [allPrograms, setAllPrograms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [programSearch, setProgramSearch] = useState("");
    const [selectedProgramToAdd, setSelectedProgramToAdd] = useState("");
    const [newBucket, setNewBucket] = useState("IMPORTANT");
    const [newWeight, setNewWeight] = useState("0.50");
    useEffect(() => {
        if (!open || !trait)
            return;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [assocPayload, programPayload] = await Promise.all([
                    request(`/api/admin/traits/${trait.id}/programs`),
                    request("/api/admin/programs")
                ]);
                setAssociations(assocPayload.data.map((item) => normalizeTraitProgramAssociation(item)));
                setAllPrograms(programPayload.data.map((program) => normalizeProgram(program)));
            }
            catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Failed to load associated programs.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [open, trait]);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (event) => {
            if (event.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);
    const linkedProgramIds = useMemo(() => new Set(associations.map((item) => item.programId)), [associations]);
    const availablePrograms = useMemo(() => {
        const q = programSearch.trim().toLowerCase();
        return allPrograms
            .filter((program) => !linkedProgramIds.has(program.id))
            .filter((program) => (q ? program.name.toLowerCase().includes(q) : true))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allPrograms, linkedProgramIds, programSearch]);
    useEffect(() => {
        if (!open)
            return;
        const firstOption = availablePrograms[0]?.id ?? "";
        setSelectedProgramToAdd(firstOption);
    }, [open, availablePrograms]);
    const persistPatch = async (programId, patch) => {
        if (!trait)
            return;
        const previous = associations;
        setAssociations((current) => current.map((item) => item.programId === programId
            ? {
                ...item,
                ...(patch.bucket ? { bucket: patch.bucket } : {}),
                ...(patch.weight !== undefined ? { weight: patch.weight } : {})
            }
            : item));
        setSaving(true);
        setError(null);
        try {
            await request(`/api/admin/traits/${trait.id}/programs/${programId}`, {
                method: "PATCH",
                body: JSON.stringify(patch)
            });
            onAssociationsChanged();
        }
        catch (patchError) {
            setAssociations(previous);
            setError(patchError instanceof Error ? patchError.message : "Failed to update association.");
        }
        finally {
            setSaving(false);
        }
    };
    const addAssociation = async () => {
        if (!trait || !selectedProgramToAdd)
            return;
        const selectedProgram = allPrograms.find((program) => program.id === selectedProgramToAdd);
        if (!selectedProgram)
            return;
        const optimistic = {
            programId: selectedProgram.id,
            programName: selectedProgram.name,
            bucket: newBucket,
            weight: Number(newWeight),
            updatedAt: new Date().toISOString()
        };
        const previous = associations;
        setAssociations((current) => [...current, optimistic]);
        setSaving(true);
        setError(null);
        try {
            const payload = await request(`/api/admin/traits/${trait.id}/programs`, {
                method: "POST",
                body: JSON.stringify({
                    programId: selectedProgram.id,
                    bucket: newBucket,
                    weight: Number(newWeight)
                })
            });
            setAssociations((current) => current.map((item) => (item.programId === optimistic.programId ? payload.data : item)));
            setProgramSearch("");
            setNewBucket("IMPORTANT");
            setNewWeight("0.50");
            onAssociationsChanged();
        }
        catch (addError) {
            setAssociations(previous);
            setError(addError instanceof Error ? addError.message : "Failed to add program association.");
        }
        finally {
            setSaving(false);
        }
    };
    const removeAssociation = async (programId) => {
        if (!trait)
            return;
        const target = associations.find((item) => item.programId === programId);
        if (!target)
            return;
        const approved = window.confirm(`Remove ${target.programName} from ${trait.name}?`);
        if (!approved)
            return;
        const previous = associations;
        setAssociations((current) => current.filter((item) => item.programId !== programId));
        setSaving(true);
        setError(null);
        try {
            await request(`/api/admin/traits/${trait.id}/programs/${programId}`, { method: "DELETE" });
            onAssociationsChanged();
        }
        catch (deleteError) {
            setAssociations(previous);
            setError(deleteError instanceof Error ? deleteError.message : "Failed to remove association.");
        }
        finally {
            setSaving(false);
        }
    };
    if (!open || !trait)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-40 flex justify-end bg-black/30", role: "presentation", onClick: onClose, children: _jsxs("aside", { className: "h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl", role: "dialog", "aria-modal": "true", "aria-label": "Trait associated programs", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-slate-900", children: trait.name }), _jsx("p", { className: "text-sm text-slate-500", children: trait.category })] }), _jsx("button", { type: "button", className: "text-sm text-slate-600 hover:text-slate-900", onClick: onClose, children: "Close" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-end gap-2", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("label", { className: labelClass, children: "Add Program" }), _jsx("input", { className: inputClass, placeholder: "Search programs...", value: programSearch, onChange: (event) => setProgramSearch(event.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Bucket" }), _jsx("select", { className: inputClass, value: newBucket, onChange: (event) => setNewBucket(event.target.value), children: programTraitPriorityBuckets.map((bucket) => (_jsx("option", { value: bucket, children: bucket }, bucket))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Weight" }), _jsx("input", { className: inputClass, type: "number", min: 0, max: 1, step: 0.05, value: newWeight, onChange: (event) => setNewWeight(event.target.value) })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("select", { className: `${inputClass} max-w-md`, value: selectedProgramToAdd, onChange: (event) => setSelectedProgramToAdd(event.target.value), children: [availablePrograms.length === 0 && _jsx("option", { value: "", children: "No available programs" }), availablePrograms.map((program) => (_jsx("option", { value: program.id, children: program.name }, program.id)))] }), _jsx(Button, { type: "button", disabled: saving || availablePrograms.length === 0 || !selectedProgramToAdd, onClick: () => void addAssociation(), children: "Add Program" })] }), error && _jsx("p", { className: "text-sm text-red-700", children: error }), loading ? (_jsx("p", { className: "text-sm text-slate-500", children: "Loading associated programs\u2026" })) : associations.length === 0 ? (_jsxs("div", { className: "rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600", children: [_jsx("p", { children: "Not linked" }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "Link this trait to a program to control scoring priority." })] })) : (_jsx("div", { className: "overflow-hidden rounded-md border border-slate-200", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "bg-slate-50 text-xs uppercase tracking-wide text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 font-medium", children: "Program" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Priority Bucket" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Weight" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Updated At" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Actions" })] }) }), _jsx("tbody", { children: associations.map((item) => (_jsxs("tr", { className: "border-t border-slate-200", children: [_jsx("td", { className: "px-3 py-2", children: _jsx("button", { type: "button", className: "text-slate-700 underline hover:text-slate-900", onClick: () => onProgramOpen(item.programId), children: item.programName }) }), _jsx("td", { className: "px-3 py-2", children: _jsx("select", { className: "rounded-md border border-slate-300 px-2 py-1 text-xs", value: item.bucket, onChange: (event) => void persistPatch(item.programId, { bucket: event.target.value }), children: programTraitPriorityBuckets.map((bucket) => (_jsx("option", { value: bucket, children: bucket }, bucket))) }) }), _jsx("td", { className: "px-3 py-2", children: _jsx("input", { className: "w-20 rounded-md border border-slate-300 px-2 py-1 text-xs", type: "number", min: 0, max: 1, step: 0.05, defaultValue: item.weight.toFixed(2), onBlur: (event) => {
                                                            const parsed = Number(event.target.value);
                                                            if (!Number.isFinite(parsed)) {
                                                                event.target.value = item.weight.toFixed(2);
                                                                return;
                                                            }
                                                            const clamped = Math.max(0, Math.min(1, parsed));
                                                            event.target.value = clamped.toFixed(2);
                                                            if (Math.abs(clamped - item.weight) < 0.001)
                                                                return;
                                                            void persistPatch(item.programId, { weight: clamped });
                                                        } }) }), _jsx("td", { className: "px-3 py-2 text-xs text-slate-500", children: new Date(item.updatedAt).toLocaleDateString() }), _jsx("td", { className: "px-3 py-2", children: _jsx("button", { type: "button", className: "text-xs text-red-600 hover:text-red-700", onClick: () => void removeAssociation(item.programId), children: "Remove" }) })] }, item.programId))) })] }) }))] })] }) }));
}
function ProgramLibraryRow({ program, selected, onSelect }) {
    const secondary = program.department?.trim() || program.degreeLevel?.trim() || "No department";
    const statusMeta = programListStatusMeta[mapProgramListStatus(program)];
    return (_jsx("div", { role: "button", tabIndex: 0, "aria-current": selected ? "true" : undefined, "data-testid": `program-row-${program.id}`, className: [
            "group relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700",
            selected ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50"
        ].join(" "), onClick: onSelect, onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
            }
        }, children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate font-semibold text-slate-900", children: program.name }), _jsx("div", { className: "mt-0.5 truncate text-xs text-slate-500", children: secondary })] }), _jsxs("div", { className: `mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${statusMeta.textClassName}`, children: [_jsx("span", { "aria-hidden": "true", className: `h-1.5 w-1.5 rounded-full ${statusMeta.dotClassName}` }), _jsx("span", { children: statusMeta.label })] })] }) }));
}
export function ProgramsPage() {
    const [programs, setPrograms] = useState([]);
    const [traits, setTraits] = useState([]);
    const [selectedProgramId, setSelectedProgramId] = useState(null);
    const [board, setBoard] = useState(createEmptyProgramBoardState);
    const [savedBoard, setSavedBoard] = useState(createEmptyProgramBoardState);
    const [programForm, setProgramForm] = useState({
        name: "",
        description: "",
        degreeLevel: "",
        department: "",
        isActive: false
    });
    const [programSearch, setProgramSearch] = useState("");
    const [debouncedProgramSearch, setDebouncedProgramSearch] = useState("");
    const [programsLoading, setProgramsLoading] = useState(false);
    const [isCreatingProgramDraft, setIsCreatingProgramDraft] = useState(false);
    const [traitModalOpen, setTraitModalOpen] = useState(false);
    const [removingTrait, setRemovingTrait] = useState(null);
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
    const [expandedBuckets, setExpandedBuckets] = useState(() => new Set(["CRITICAL", "VERY_IMPORTANT", "IMPORTANT"]));
    const cancelRemoveButtonRef = useRef(null);
    const confirmRemoveButtonRef = useRef(null);
    const programNameInputRef = useRef(null);
    const focusProgramNameOnSelectRef = useRef(false);
    const toggleBucketExpanded = (bucket) => {
        setExpandedBuckets((prev) => {
            const next = new Set(prev);
            if (next.has(bucket))
                next.delete(bucket);
            else
                next.add(bucket);
            return next;
        });
    };
    const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? null;
    const boardDirty = useMemo(() => isBoardDirty(board, savedBoard), [board, savedBoard]);
    const programDirty = useMemo(() => {
        if (!selectedProgram)
            return false;
        return (programForm.name !== selectedProgram.name ||
            programForm.description !== (selectedProgram.description ?? "") ||
            programForm.degreeLevel !== (selectedProgram.degreeLevel ?? "") ||
            programForm.department !== (selectedProgram.department ?? "") ||
            programForm.isActive !== selectedProgram.isActive);
    }, [selectedProgram, programForm]);
    const pageDirty = programDirty || boardDirty;
    const [saveStatus, setSaveStatus] = useState("idle");
    const [saveError, setSaveError] = useState(null);
    const [programStatusFilter, setProgramStatusFilter] = useState("ALL");
    const [statusToast, setStatusToast] = useState(null);
    const [statusToggleInFlight, setStatusToggleInFlight] = useState(null);
    const statusToastTimerRef = useRef(null);
    const inactiveProgramCount = useMemo(() => programs.filter((program) => mapProgramListStatus(program) === "INACTIVE").length, [programs]);
    const filteredPrograms = useMemo(() => {
        const q = debouncedProgramSearch.trim().toLowerCase();
        const statusFiltered = programStatusFilter === "INACTIVE"
            ? programs.filter((program) => mapProgramListStatus(program) === "INACTIVE")
            : programs;
        const sorted = [...statusFiltered].sort((a, b) => a.name.localeCompare(b.name));
        if (!q)
            return sorted;
        return sorted.filter((program) => {
            const nameMatch = program.name.toLowerCase().includes(q);
            const departmentMatch = (program.department ?? "").toLowerCase().includes(q);
            return nameMatch || departmentMatch;
        });
    }, [programs, debouncedProgramSearch, programStatusFilter]);
    const loadPrograms = async () => {
        setProgramsLoading(true);
        try {
            const payload = await request("/api/admin/programs");
            const normalizedPrograms = payload.data.map((program) => normalizeProgram(program));
            const preferredProgramId = window.sessionStorage.getItem("pmm:selectedProgramId");
            setPrograms(normalizedPrograms);
            if (normalizedPrograms.length > 0 &&
                preferredProgramId &&
                normalizedPrograms.some((program) => program.id === preferredProgramId)) {
                setSelectedProgramId(preferredProgramId);
                window.sessionStorage.removeItem("pmm:selectedProgramId");
            }
            else if (normalizedPrograms.length > 0 && !normalizedPrograms.some((program) => program.id === selectedProgramId)) {
                setSelectedProgramId(normalizedPrograms[0]?.id ?? null);
            }
            if (normalizedPrograms.length === 0) {
                setSelectedProgramId(null);
                const empty = createEmptyProgramBoardState();
                setBoard(empty);
                setSavedBoard(empty);
            }
        }
        finally {
            setProgramsLoading(false);
        }
    };
    const loadTraits = async () => {
        const payload = await request("/api/admin/traits");
        setTraits(payload.data.map((trait) => normalizeTrait(trait)));
    };
    const loadProgramTraits = async (programId) => {
        const payload = await request(`/api/admin/programs/${programId}/traits`);
        const nextState = createEmptyProgramBoardState();
        for (const item of payload.data) {
            nextState[item.bucket].push(normalizeTrait(item.trait));
        }
        setBoard(nextState);
        setSavedBoard(nextState);
    };
    useEffect(() => {
        void Promise.all([loadPrograms(), loadTraits()]);
    }, []);
    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedProgramSearch(programSearch);
        }, 200);
        return () => window.clearTimeout(timeoutId);
    }, [programSearch]);
    useEffect(() => {
        if (!selectedProgramId) {
            const empty = createEmptyProgramBoardState();
            setBoard(empty);
            setSavedBoard(empty);
            return;
        }
        void loadProgramTraits(selectedProgramId);
    }, [selectedProgramId]);
    useEffect(() => {
        if (!selectedProgram) {
            setProgramForm({ name: "", description: "", degreeLevel: "", department: "", isActive: false });
            return;
        }
        setProgramForm({
            name: selectedProgram.name,
            description: selectedProgram.description ?? "",
            degreeLevel: selectedProgram.degreeLevel ?? "",
            department: selectedProgram.department ?? "",
            isActive: selectedProgram.isActive
        });
    }, [selectedProgram]);
    useEffect(() => {
        if (!selectedProgramId || !focusProgramNameOnSelectRef.current)
            return;
        focusProgramNameOnSelectRef.current = false;
        window.setTimeout(() => {
            programNameInputRef.current?.focus();
            programNameInputRef.current?.select();
        }, 0);
    }, [selectedProgramId]);
    useEffect(() => {
        return () => {
            if (statusToastTimerRef.current !== null) {
                window.clearTimeout(statusToastTimerRef.current);
            }
        };
    }, []);
    const showStatusToast = (toast) => {
        if (statusToastTimerRef.current !== null) {
            window.clearTimeout(statusToastTimerRef.current);
        }
        setStatusToast(toast);
        statusToastTimerRef.current = window.setTimeout(() => {
            setStatusToast(null);
            statusToastTimerRef.current = null;
        }, 2400);
    };
    const toggleProgramActive = async (programId, nextIsActive) => {
        if (statusToggleInFlight)
            return;
        const previous = programs.find((program) => program.id === programId);
        if (!previous)
            return;
        setStatusToggleInFlight(programId);
        setPrograms((current) => current.map((program) => program.id === programId ? { ...program, isActive: nextIsActive, updatedAt: new Date().toISOString() } : program));
        try {
            const payload = await request(`/api/admin/programs/${programId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ isActive: nextIsActive })
            });
            const normalized = normalizeProgram(payload.data);
            setPrograms((current) => current.map((program) => (program.id === programId ? normalized : program)));
            showStatusToast({
                type: "success",
                message: `Program marked ${normalized.isActive ? "Active" : "Inactive"}.`
            });
        }
        catch (error) {
            setPrograms((current) => current.map((program) => (program.id === programId ? previous : program)));
            showStatusToast({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to update program status."
            });
        }
        finally {
            setStatusToggleInFlight(null);
        }
    };
    const createProgram = async (event) => {
        event.preventDefault();
        const payload = await request("/api/admin/programs", {
            method: "POST",
            body: JSON.stringify(programForm)
        });
        await loadPrograms();
        setSelectedProgramId(normalizeProgram(payload.data).id);
    };
    const startNewProgram = async () => {
        if (isCreatingProgramDraft)
            return;
        const untitledBase = "Untitled program";
        const untitledNames = new Set(programs
            .map((program) => program.name)
            .filter((name) => name === untitledBase || /^Untitled program \d+$/.test(name)));
        let draftName = untitledBase;
        if (untitledNames.has(untitledBase)) {
            let suffix = 2;
            while (untitledNames.has(`${untitledBase} ${suffix}`)) {
                suffix += 1;
            }
            draftName = `${untitledBase} ${suffix}`;
        }
        setIsCreatingProgramDraft(true);
        setSaveError(null);
        try {
            const payload = await request("/api/admin/programs", {
                method: "POST",
                body: JSON.stringify({
                    name: draftName,
                    description: "",
                    degreeLevel: "",
                    department: ""
                })
            });
            const normalizedProgram = normalizeProgram(payload.data);
            setPrograms((prev) => [normalizedProgram, ...prev.filter((program) => program.id !== normalizedProgram.id)]);
            focusProgramNameOnSelectRef.current = true;
            setSelectedProgramId(normalizedProgram.id);
            await loadPrograms();
        }
        catch (error) {
            setSaveError(error instanceof Error ? error.message : "Failed to create program.");
            setSaveStatus("error");
        }
        finally {
            setIsCreatingProgramDraft(false);
        }
    };
    const deleteProgram = async (id) => {
        await request(`/api/admin/programs/${id}`, { method: "DELETE" });
        await loadPrograms();
    };
    const moveTrait = (fromBucket, fromIndex, toBucket, toIndex) => {
        setBoard((current) => moveTraitInBoard(current, fromBucket, fromIndex, toBucket, toIndex));
    };
    const openRemoveDialog = (trait) => {
        setRemovingTrait(trait);
        setRemoveDialogOpen(true);
    };
    const confirmRemoveTrait = () => {
        if (!removingTrait) {
            return;
        }
        setBoard((current) => removeTraitFromBoard(current, removingTrait.id).nextBoard);
        setRemovingTrait(null);
        setRemoveDialogOpen(false);
    };
    const cancelRemoveTrait = () => {
        setRemovingTrait(null);
        setRemoveDialogOpen(false);
    };
    const onRemoveDialogKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            cancelRemoveTrait();
            return;
        }
        if (event.key === "Tab") {
            const first = cancelRemoveButtonRef.current;
            const last = confirmRemoveButtonRef.current;
            if (!first || !last) {
                return;
            }
            if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
            else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        }
    };
    const saveBoard = async () => {
        if (!selectedProgramId)
            return;
        const boardIds = toBoardIdState(board);
        await request(`/api/admin/programs/${selectedProgramId}/traits`, {
            method: "PUT",
            body: JSON.stringify({
                items: boardStateToProgramTraitRows(boardIds)
            })
        });
        await loadProgramTraits(selectedProgramId);
    };
    const saveAllChanges = async () => {
        if (!pageDirty)
            return;
        setSaveError(null);
        setSaveStatus("saving");
        try {
            if (programDirty && selectedProgramId) {
                await request(`/api/admin/programs/${selectedProgramId}`, {
                    method: "PUT",
                    body: JSON.stringify(programForm)
                });
                await loadPrograms();
            }
            if (boardDirty && selectedProgramId) {
                await saveBoard();
            }
            setSaveStatus("saved");
            window.setTimeout(() => setSaveStatus("idle"), 2000);
        }
        catch (error) {
            setSaveError(error instanceof Error ? error.message : "Failed to save changes.");
            setSaveStatus("error");
        }
    };
    const assignedTraitIds = useMemo(() => {
        const ids = new Set();
        for (const bucket of Object.keys(board)) {
            for (const trait of board[bucket]) {
                ids.add(trait.id);
            }
        }
        return ids;
    }, [board]);
    const nonActiveBoardTraits = useMemo(() => {
        const items = [];
        const seen = new Set();
        for (const bucket of programTraitPriorityBuckets) {
            for (const trait of board[bucket]) {
                if (seen.has(trait.id))
                    continue;
                const status = trait.status ?? "DRAFT";
                if (status !== "ACTIVE") {
                    seen.add(trait.id);
                    items.push({
                        id: trait.id,
                        name: trait.name,
                        status
                    });
                }
            }
        }
        return items;
    }, [board]);
    const programScoringReadiness = useMemo(() => {
        const uniqueTraits = new Map();
        for (const bucket of programTraitPriorityBuckets) {
            for (const trait of board[bucket]) {
                if (!uniqueTraits.has(trait.id)) {
                    uniqueTraits.set(trait.id, trait.status ?? "DRAFT");
                }
            }
        }
        const totalTraits = uniqueTraits.size;
        const activeTraits = [...uniqueTraits.values()].filter((status) => status === "ACTIVE").length;
        const missing = [];
        if (totalTraits === 0) {
            missing.push("Add at least 1 trait to the priority board.");
        }
        if (activeTraits === 0) {
            missing.push("Mark at least 1 assigned trait as Active.");
        }
        return {
            isScorable: missing.length === 0,
            missing,
            totalTraits,
            activeTraits,
            nonActiveTraits: Math.max(0, totalTraits - activeTraits)
        };
    }, [board]);
    const addTraitsToBoard = (traitIds, destinationBucket) => {
        if (!selectedProgramId)
            return;
        const existingIds = new Set();
        for (const bucket of Object.keys(board)) {
            for (const trait of board[bucket]) {
                existingIds.add(trait.id);
            }
        }
        const nextTraits = traits.filter((trait) => traitIds.includes(trait.id) && !existingIds.has(trait.id));
        if (nextTraits.length === 0) {
            setTraitModalOpen(false);
            return;
        }
        const nextBoard = {
            ...board,
            [destinationBucket]: [...board[destinationBucket], ...nextTraits]
        };
        setBoard(nextBoard);
        setTraitModalOpen(false);
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [pageDirty && (_jsx("span", { className: "text-sm font-medium text-amber-700", role: "status", children: "Unsaved changes" })), saveStatus === "saving" && (_jsx("span", { className: "text-sm text-slate-500", role: "status", children: "Saving..." })), saveStatus === "saved" && (_jsx("span", { className: "text-sm text-emerald-700", role: "status", children: "All changes saved" })), saveStatus === "error" && saveError && (_jsx("span", { className: "text-sm text-red-700", role: "alert", children: saveError }))] }), _jsx(Button, { type: "button", onClick: () => void saveAllChanges(), disabled: !pageDirty || saveStatus === "saving", children: "Save Changes" })] }), _jsxs("div", { className: "grid items-start gap-4 lg:grid-cols-[minmax(16rem,18rem)_minmax(18rem,22rem)_minmax(0,1fr)]", children: [_jsxs(Card, { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Programs" }), _jsx("button", { type: "button", onClick: () => void startNewProgram(), disabled: isCreatingProgramDraft, "aria-busy": isCreatingProgramDraft ? "true" : undefined, className: `${subtleButtonClass} disabled:cursor-not-allowed disabled:opacity-60`, children: isCreatingProgramDraft ? "Saving..." : "+ New Program" })] }), _jsxs("div", { className: "space-y-2", children: [inactiveProgramCount > 0 && (_jsxs("div", { className: "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900", children: [_jsxs("p", { children: [inactiveProgramCount, " program", inactiveProgramCount !== 1 ? "s are" : " is", " Inactive and will not be used in matchmaking."] }), _jsx("button", { type: "button", className: "mt-1 font-semibold underline", onClick: () => setProgramStatusFilter((current) => (current === "INACTIVE" ? "ALL" : "INACTIVE")), children: programStatusFilter === "INACTIVE" ? "Show all" : "Show inactive" })] })), _jsx("input", { className: inputClass, placeholder: "Search programs...", value: programSearch, onChange: (event) => setProgramSearch(event.target.value) }), programStatusFilter === "INACTIVE" && (_jsx("p", { className: "text-xs text-slate-600", children: "Filtering to Inactive programs." })), programsLoading && _jsx("p", { className: "text-sm text-slate-500", children: "Loading..." }), !programsLoading && programs.length === 0 && (_jsx("p", { className: "text-sm text-slate-500", children: "No programs yet. Create one to begin." })), !programsLoading && programs.length > 0 && filteredPrograms.length === 0 && (_jsxs("div", { className: "text-sm text-slate-500", children: [_jsx("p", { children: "No programs found." }), _jsx("button", { type: "button", className: "mt-1 text-xs font-medium text-slate-700 hover:text-slate-900", onClick: () => setProgramSearch(""), children: "Clear search" })] })), filteredPrograms.map((program) => (_jsx(ProgramLibraryRow, { program: program, selected: selectedProgramId === program.id, onSelect: () => setSelectedProgramId(program.id) }, program.id)))] })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-lg font-semibold", children: selectedProgram ? "Edit Program" : "Create Program" }), _jsxs("form", { className: "space-y-3", onSubmit: (event) => {
                                    event.preventDefault();
                                    if (selectedProgram)
                                        return;
                                    void createProgram(event);
                                }, children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Name" }), _jsx("input", { ref: programNameInputRef, required: true, className: inputClass, value: programForm.name, onChange: (event) => setProgramForm((prev) => ({ ...prev, name: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Description" }), _jsx("textarea", { className: inputClass, value: programForm.description, onChange: (event) => setProgramForm((prev) => ({ ...prev, description: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Degree Level" }), _jsx("input", { className: inputClass, value: programForm.degreeLevel, onChange: (event) => setProgramForm((prev) => ({ ...prev, degreeLevel: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Department" }), _jsx("input", { className: inputClass, value: programForm.department, onChange: (event) => setProgramForm((prev) => ({ ...prev, department: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Active" }), _jsxs("div", { className: "flex items-center justify-between rounded-md border border-slate-300 px-3 py-2", children: [_jsx("span", { className: "text-sm text-slate-700", children: "Active programs are included in matchmaking." }), _jsx("button", { type: "button", role: "switch", "aria-checked": programForm.isActive, "aria-label": "Active", disabled: !selectedProgram || statusToggleInFlight === selectedProgram.id, onClick: () => {
                                                            if (!selectedProgram)
                                                                return;
                                                            const nextValue = !programForm.isActive;
                                                            setProgramForm((prev) => ({ ...prev, isActive: nextValue }));
                                                            void toggleProgramActive(selectedProgram.id, nextValue);
                                                        }, className: `relative inline-flex h-6 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${programForm.isActive ? "bg-emerald-600" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-60`, children: _jsx("span", { className: `inline-block h-5 w-5 shrink-0 transform rounded-full bg-white transition-transform ${programForm.isActive ? "translate-x-[22px]" : "translate-x-0"}` }) })] })] }), _jsxs("div", { className: "flex gap-2", children: [!selectedProgram && _jsx(Button, { type: "submit", children: "Create Program" }), selectedProgram && (_jsx("button", { type: "button", className: "text-sm text-red-700 underline", onClick: () => void deleteProgram(selectedProgram.id), children: "Delete" }))] })] })] }), _jsxs(Card, { children: [_jsxs("div", { className: "sticky top-0 z-10 mb-3 flex items-center justify-between bg-white pb-2", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Trait Priority Board" }), _jsx("button", { type: "button", className: `${subtleButtonClass} disabled:cursor-not-allowed disabled:opacity-50`, onClick: () => setTraitModalOpen(true), disabled: !selectedProgram, children: "Add Trait" })] }), !selectedProgram ? (_jsx("p", { className: "text-sm text-slate-500", children: "Select a program to edit board priorities." })) : (_jsxs("div", { className: "flex min-h-[20rem] flex-col gap-4 pb-2", children: [!programScoringReadiness.isScorable && (_jsxs("div", { className: "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900", children: [_jsx("p", { className: "font-medium", children: "This program cannot be scored yet." }), _jsx("ul", { className: "mt-2 list-disc space-y-1 pl-5 text-xs", children: programScoringReadiness.missing.map((item) => (_jsx("li", { children: item }, item))) })] })), programScoringReadiness.isScorable && nonActiveBoardTraits.length > 0 && (_jsxs("div", { className: "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900", children: [_jsxs("p", { className: "font-medium", children: [nonActiveBoardTraits.length, " trait", nonActiveBoardTraits.length !== 1 ? "s are" : " is", " not Active and will not affect scoring."] }), _jsx("ul", { className: "mt-2 list-disc space-y-1 pl-5 text-xs", children: nonActiveBoardTraits.map((trait) => (_jsxs("li", { children: [trait.name, " (", trait.status.replaceAll("_", " "), ")"] }, trait.id))) })] })), programTraitPriorityBuckets.map((bucket) => {
                                        const isExpanded = expandedBuckets.has(bucket);
                                        return (_jsxs("div", { className: "flex-shrink-0 rounded-lg border border-slate-200 bg-slate-50/80 shadow-sm", onDragOver: (event) => event.preventDefault(), onDrop: (event) => {
                                                event.preventDefault();
                                                const payload = event.dataTransfer.getData("text/plain");
                                                if (!payload) {
                                                    return;
                                                }
                                                const parsed = JSON.parse(payload);
                                                if (!isExpanded) {
                                                    setExpandedBuckets((prev) => new Set(prev).add(bucket));
                                                }
                                                moveTrait(parsed.fromBucket, parsed.fromIndex, bucket);
                                            }, children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 px-3 py-2", children: [_jsxs("button", { type: "button", onClick: () => toggleBucketExpanded(bucket), className: "flex min-w-0 flex-1 items-center gap-2 rounded text-left text-sm font-semibold text-slate-800 hover:bg-slate-100/80", "aria-expanded": isExpanded, "aria-label": isExpanded ? `Collapse ${bucket}` : `Expand ${bucket}`, children: [_jsx("span", { className: "flex-shrink-0 text-slate-500", "aria-hidden": true, children: isExpanded ? "\u25BC" : "\u25B6" }), _jsxs("span", { className: "truncate", children: [bucket, " (", board[bucket].length, ")"] })] }), board[bucket].length === 0 && (_jsx("span", { className: "text-xs text-slate-500", children: "Drag traits here" }))] }), isExpanded && (_jsxs("div", { className: "min-h-[4rem] space-y-2 p-3", children: [board[bucket].length === 0 && (_jsx("p", { className: "rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-center text-xs text-slate-500", children: "Drag traits here" })), board[bucket].map((trait, index) => (_jsx("div", { draggable: true, onDragStart: (event) => event.dataTransfer.setData("text/plain", JSON.stringify({
                                                                fromBucket: bucket,
                                                                fromIndex: index
                                                            })), onDragOver: (event) => event.preventDefault(), onDrop: (event) => {
                                                                event.preventDefault();
                                                                const payload = event.dataTransfer.getData("text/plain");
                                                                if (!payload) {
                                                                    return;
                                                                }
                                                                const parsed = JSON.parse(payload);
                                                                moveTrait(parsed.fromBucket, parsed.fromIndex, bucket, index);
                                                            }, className: "group rounded-md border border-slate-300 bg-white p-2 text-sm transition hover:border-slate-400 hover:bg-slate-50", children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-2", children: [_jsx("button", { type: "button", className: "mt-0.5 cursor-grab rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700", title: "Drag trait", "aria-label": `Drag ${trait.name}`, children: "::" }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate font-medium", children: trait.name }), _jsx("div", { className: "text-xs text-slate-500", children: trait.category }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-1.5", children: [_jsx("span", { className: `rounded-full px-2 py-0.5 text-[11px] ${traitStatusTone[trait.status]}`, children: trait.status.replaceAll("_", " ") }), trait.status !== "ACTIVE" && (_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800", children: "Excluded from scoring" }))] })] })] }), _jsx("button", { type: "button", className: "rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100", "aria-label": `Remove ${trait.name} from board`, onClick: () => openRemoveDialog(trait), children: "x" })] }) }, trait.id)))] }))] }, bucket));
                                    })] })), removeDialogOpen && removingTrait && (_jsx("div", { className: "fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4", role: "presentation", children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "remove-trait-title", "aria-describedby": "remove-trait-body", className: "w-full max-w-md rounded-md bg-white p-4 shadow-lg", onKeyDown: onRemoveDialogKeyDown, children: [_jsx("h3", { id: "remove-trait-title", className: "text-lg font-semibold", children: "Remove trait from this program?" }), _jsx("p", { id: "remove-trait-body", className: "mt-2 text-sm text-slate-600", children: "This will remove the trait from the priority board for this program. It will not delete the trait from the library." }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { type: "button", className: subtleButtonClass, autoFocus: true, ref: cancelRemoveButtonRef, onClick: cancelRemoveTrait, "aria-label": "Cancel trait removal", children: "Cancel" }), _jsx("button", { type: "button", className: "rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800", ref: confirmRemoveButtonRef, onClick: confirmRemoveTrait, "aria-label": `Remove ${removingTrait.name} from board`, children: "Remove" })] })] }) })), _jsx(TraitPickerModal, { isOpen: traitModalOpen, onClose: () => setTraitModalOpen(false), traits: traits, assignedTraitIds: assignedTraitIds, programId: selectedProgram?.id ?? null, degreeLevel: selectedProgram?.degreeLevel ?? null, department: selectedProgram?.department ?? null, onAddTraits: addTraitsToBoard })] })] }), statusToast && (_jsx("div", { role: "status", className: `fixed bottom-4 right-4 rounded-md px-4 py-2 text-sm text-white shadow-lg ${statusToast.type === "success" ? "bg-emerald-700" : "bg-red-700"}`, children: statusToast.message }))] }));
}
export function BrandVoicePage() {
    const defaultBrandVoiceForm = () => ({
        name: "",
        primaryTone: "professional",
        ttsVoiceName: "alloy",
        toneModifiers: ["encouraging"],
        toneProfile: { ...defaultToneProfile },
        styleFlags: [...defaultStyleFlags],
        avoidFlags: [...defaultAvoidFlags],
        canonicalExamples: []
    });
    const [voices, setVoices] = useState([]);
    const [selectedVoiceId, setSelectedVoiceId] = useState(null);
    const [form, setForm] = useState(defaultBrandVoiceForm);
    const [seedText, setSeedText] = useState("");
    const [previewOverride, setPreviewOverride] = useState({});
    const [generatedSamples, setGeneratedSamples] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTestingVoice, setIsTestingVoice] = useState(false);
    const [voiceTestText, setVoiceTestText] = useState("Welcome to Graduate Admissions. Let me walk you through your next best step.");
    const [voiceTestUrl, setVoiceTestUrl] = useState(null);
    const [error, setError] = useState(null);
    const [saveNotice, setSaveNotice] = useState(null);
    const [activeTab, setActiveTab] = useState("configuration");
    const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId) ?? null;
    const preview = useMemo(() => {
        const base = generateBrandVoicePreview({
            name: form.name,
            primaryTone: form.primaryTone,
            toneModifiers: form.toneModifiers,
            toneProfile: form.toneProfile,
            styleFlags: form.styleFlags,
            avoidFlags: form.avoidFlags,
            seedText
        });
        return { ...base, ...previewOverride };
    }, [form, previewOverride, seedText]);
    const loadVoices = async () => {
        const payload = await request("/api/admin/brand-voices");
        setVoices(payload.data);
        if (payload.data.length > 0 && !payload.data.some((voice) => voice.id === selectedVoiceId)) {
            setSelectedVoiceId(payload.data[0]?.id ?? null);
        }
        if (payload.data.length === 0) {
            setSelectedVoiceId(null);
        }
    };
    useEffect(() => {
        void loadVoices();
    }, []);
    useEffect(() => {
        if (!saveNotice)
            return;
        const timeoutId = window.setTimeout(() => setSaveNotice(null), 2200);
        return () => window.clearTimeout(timeoutId);
    }, [saveNotice]);
    useEffect(() => {
        if (!selectedVoice) {
            setForm(defaultBrandVoiceForm());
            setGeneratedSamples(null);
            setPreviewOverride({});
            setVoiceTestUrl(null);
            return;
        }
        setForm({
            name: selectedVoice.name,
            primaryTone: selectedVoice.primaryTone ?? "professional",
            ttsVoiceName: selectedVoice.ttsVoiceName ?? "alloy",
            toneModifiers: selectedVoice.toneModifiers ?? [],
            toneProfile: selectedVoice.toneProfile ?? { ...defaultToneProfile },
            styleFlags: selectedVoice.styleFlags ?? [],
            avoidFlags: selectedVoice.avoidFlags ?? [],
            canonicalExamples: selectedVoice.canonicalExamples ?? []
        });
        setGeneratedSamples(null);
        setPreviewOverride({});
        setVoiceTestUrl(null);
    }, [selectedVoice]);
    const createVoice = async (event) => {
        event.preventDefault();
        setError(null);
        setSaveNotice(null);
        try {
            const payload = await request("/api/admin/brand-voices", {
                method: "POST",
                body: JSON.stringify({
                    ...form,
                    canonicalExamples: form.canonicalExamples.filter((item) => item.pinned)
                })
            });
            await loadVoices();
            setSelectedVoiceId(payload.data.id);
            setSaveNotice("Brand voice created.");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create brand voice");
        }
    };
    const saveVoice = async (event) => {
        event.preventDefault();
        if (!selectedVoiceId) {
            return;
        }
        setError(null);
        setSaveNotice(null);
        try {
            await request(`/api/admin/brand-voices/${selectedVoiceId}`, {
                method: "PUT",
                body: JSON.stringify({
                    ...form,
                    canonicalExamples: form.canonicalExamples.filter((item) => item.pinned)
                })
            });
            await loadVoices();
            setSaveNotice("Brand voice saved.");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save brand voice");
        }
    };
    const deleteVoice = async (id) => {
        await request(`/api/admin/brand-voices/${id}`, { method: "DELETE" });
        await loadVoices();
        setSaveNotice("Brand voice deleted.");
    };
    const generateSamples = async () => {
        if (!selectedVoiceId) {
            return;
        }
        setError(null);
        setIsGenerating(true);
        try {
            const payload = await request(`/api/admin/brand-voices/${selectedVoiceId}/generate-samples`, {
                method: "POST",
                body: JSON.stringify({ context: { useCase: "general" } })
            });
            setGeneratedSamples(payload.samples);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate sample language");
        }
        finally {
            setIsGenerating(false);
        }
    };
    const testVoice = async (voiceName) => {
        setError(null);
        setIsTestingVoice(true);
        try {
            const payload = await request("/api/admin/brand-voices/test-voice", {
                method: "POST",
                body: JSON.stringify({
                    voiceName: voiceName ?? form.ttsVoiceName,
                    text: voiceTestText
                })
            });
            setVoiceTestUrl(payload.data.audioUrl);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to test voice");
        }
        finally {
            setIsTestingVoice(false);
        }
    };
    const pinExample = (type, text) => {
        setForm((prev) => ({
            ...prev,
            canonicalExamples: [
                ...prev.canonicalExamples.filter((item) => !(item.type === type && item.text.trim().toLowerCase() === text.trim().toLowerCase())),
                {
                    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    type,
                    text,
                    pinned: true
                }
            ]
        }));
    };
    const startNewVoice = () => {
        setSelectedVoiceId(null);
        setForm(defaultBrandVoiceForm());
        setGeneratedSamples(null);
        setPreviewOverride({});
        setVoiceTestUrl(null);
        setError(null);
        setSaveNotice(null);
        setActiveTab("configuration");
    };
    return (_jsxs("div", { className: "grid gap-4 lg:grid-cols-[260px_1fr]", children: [_jsxs(Card, { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Brand Voices" }), _jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50", onClick: startNewVoice, children: "New" })] }), _jsx("div", { className: "space-y-2", children: voices.map((voice) => (_jsxs("button", { type: "button", onClick: () => setSelectedVoiceId(voice.id), className: `w-full rounded-md border p-2 text-left text-sm ${selectedVoiceId === voice.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`, children: [_jsx("div", { className: "font-semibold", children: voice.name }), _jsx("div", { className: "text-xs text-slate-500", children: voice.primaryTone })] }, voice.id))) })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-lg font-semibold", children: selectedVoice ? "Edit Brand Voice" : "Create Brand Voice" }), _jsxs("div", { className: "mb-4 flex gap-2", children: [_jsx("button", { type: "button", className: `rounded-md border px-3 py-1.5 text-sm font-medium ${activeTab === "configuration" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`, onClick: () => setActiveTab("configuration"), children: "Configuration" }), _jsx("button", { type: "button", className: `rounded-md border px-3 py-1.5 text-sm font-medium ${activeTab === "simulation" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`, onClick: () => setActiveTab("simulation"), children: "Simulation Lab" })] }), activeTab === "configuration" ? (_jsxs("form", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]", onSubmit: (event) => void (selectedVoice ? saveVoice(event) : createVoice(event)), children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Name" }), _jsx("input", { required: true, className: inputClass, value: form.name, onChange: (event) => setForm((prev) => ({ ...prev, name: event.target.value })) })] }), _jsx(ToneSelector, { primaryTone: form.primaryTone, modifiers: form.toneModifiers, onPrimaryToneChange: (primaryTone) => setForm((prev) => ({ ...prev, primaryTone })), onModifiersChange: (toneModifiers) => setForm((prev) => ({ ...prev, toneModifiers })) }), _jsx(ToneSliders, { value: form.toneProfile, onChange: (toneProfile) => setForm((prev) => ({ ...prev, toneProfile })) }), _jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsx("h3", { className: "mb-2 text-sm font-semibold", children: "Voice (OpenAI TTS)" }), _jsx("label", { className: labelClass, children: "Preferred voice" }), _jsx("div", { className: "flex flex-wrap gap-2", children: openAiVoiceOptions.map((voice) => (_jsx("button", { type: "button", className: `rounded-md border px-3 py-1.5 text-sm font-medium ${form.ttsVoiceName === voice
                                                        ? "border-slate-900 bg-slate-900 text-white"
                                                        : "border-slate-300 text-slate-700 hover:bg-slate-50"}`, onClick: () => {
                                                        setForm((prev) => ({ ...prev, ttsVoiceName: voice }));
                                                        setVoiceTestUrl(null);
                                                        void testVoice(voice);
                                                    }, disabled: isTestingVoice || voiceTestText.trim().length === 0, children: isTestingVoice && form.ttsVoiceName === voice ? `Sampling ${voice}...` : voice }, `preferred-voice-${voice}`))) }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "This voice is used for simulation voice samples unless overridden." }), voiceTestUrl && (_jsx("audio", { className: "mt-2 block w-full max-w-full", controls: true, preload: "metadata", src: voiceTestUrl }, voiceTestUrl))] }), _jsx(ChipSelectWithCustom, { label: "Voice Behaviors", options: [...brandVoiceStyleFlagOptions], value: form.styleFlags, onChange: (styleFlags) => setForm((prev) => ({ ...prev, styleFlags })), addPlaceholder: "Add custom behavior" }), _jsx(ChipSelectWithCustom, { label: "Avoid", options: [...brandVoiceAvoidFlagOptions], value: form.avoidFlags, onChange: (avoidFlags) => setForm((prev) => ({ ...prev, avoidFlags })), addPlaceholder: "Add custom avoid rule" }), _jsx(CollapsibleSection, { title: "Canonical Examples", defaultOpen: false, children: _jsxs("div", { className: "space-y-2", children: [form.canonicalExamples.length === 0 && _jsx("p", { className: "text-xs text-slate-500", children: "No pinned examples yet." }), form.canonicalExamples.map((example) => (_jsxs("div", { className: "rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "mb-1 text-[11px] uppercase tracking-wide text-slate-500", children: example.type }), _jsx("div", { children: example.text })] }, example.id)))] }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", children: selectedVoice ? "Save Brand Voice" : "Create Brand Voice" }), selectedVoice && (_jsx("button", { type: "button", className: "text-sm text-red-700 underline", onClick: () => void deleteVoice(selectedVoice.id), children: "Delete" }))] }), saveNotice && _jsx("p", { className: "text-sm text-emerald-700", children: saveNotice }), error && _jsx("p", { className: "text-sm text-red-700", children: error })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Intro Context (optional)" }), _jsx("textarea", { className: inputClass, rows: 4, value: seedText, onChange: (event) => setSeedText(event.target.value), placeholder: "Example: You are speaking to first-generation students exploring grad programs." }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "This is used as opening context in the live preview samples. It shapes the preview intro language, but does not change your saved brand voice settings." })] }), _jsx(BrandVoicePreview, { title: "Live Preview", samples: preview }), _jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold", children: "Test Voice" }), _jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void testVoice(), disabled: isTestingVoice || voiceTestText.trim().length === 0, children: isTestingVoice ? "Testing..." : "Test voice" })] }), _jsx("label", { className: labelClass, children: "Sample script" }), _jsx("textarea", { className: inputClass, rows: 3, value: voiceTestText, onChange: (event) => setVoiceTestText(event.target.value), placeholder: "Enter short script to synthesize voice" }), voiceTestUrl && (_jsxs("div", { className: "mt-2 min-w-0 rounded border border-slate-200 p-2", children: [_jsx("a", { className: "block break-all text-xs text-blue-700 underline", href: voiceTestUrl, target: "_blank", rel: "noreferrer", children: "Open tested audio" }), _jsx("audio", { className: "mt-2 block w-full max-w-full", controls: true, preload: "metadata", src: voiceTestUrl })] }))] }), _jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold", children: "Generate Sample Language" }), _jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void generateSamples(), disabled: !selectedVoiceId || isGenerating, children: isGenerating ? "Generating..." : "Generate Sample Language" })] }), !selectedVoiceId && (_jsx("p", { className: "text-xs text-slate-500", children: "Create this brand voice first, then generate AI suggestions." }))] }), generatedSamples && (_jsx(GeneratedSamplesPanel, { samples: generatedSamples, onPin: pinExample, onReplacePreview: (type, text) => setPreviewOverride((prev) => ({
                                            ...prev,
                                            [type]: text
                                        })) }))] })] })) : (_jsx(SimulationLab, { brandVoiceId: selectedVoiceId, request: request }))] })] }));
}
const quizExperiencePresetLabels = {
    ADMISSIONS_MARKETING: "Admissions Marketing",
    EXECUTIVE_MBA: "Executive MBA",
    GEN_Z_SOCIAL: "Gen Z Social",
    TRADITIONAL_ACADEMIC: "Traditional Academic",
    EXPERIMENTAL_AI: "Experimental AI"
};
const getQuizExperienceStyleOptions = (form) => {
    const presetValues = Object.values(QUIZ_EXPERIENCE_PRESETS);
    const unique = (values) => [...new Set(values.filter((value) => value.trim().length > 0))];
    return {
        gradientSet: unique([...presetValues.map((item) => item.gradientSet), form.gradientSet]),
        rankingMotionStyle: unique([...presetValues.map((item) => item.rankingMotionStyle), form.rankingMotionStyle]),
        revealStyle: unique([...presetValues.map((item) => item.revealStyle), form.revealStyle]),
        tonePreset: unique([...presetValues.map((item) => item.tonePreset), form.tonePreset])
    };
};
export function QuizExperiencePage() {
    const [form, setForm] = useState({
        id: "default",
        headline: "Discover your best-fit graduate path",
        subheadline: "A quick, personality-first quiz to see where you thrive.",
        estimatedTimeLabel: "3-5 min",
        tonePreset: "GEN_Z_FRIENDLY",
        gradientSet: "SUNRISE",
        motionIntensity: "MEDIUM",
        rankingMotionStyle: "SPRING",
        revealStyle: "IDENTITY",
        experiencePreset: "ADMISSIONS_MARKETING",
        experienceOverrides: null,
        introMediaPrompt: "",
        revealMediaPrompt: ""
    });
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);
    const presetDefaults = form.experiencePreset ? QUIZ_EXPERIENCE_PRESETS[form.experiencePreset] : null;
    const overrides = form.experienceOverrides ?? {};
    const effective = form.experiencePreset
        ? resolveQuizExperienceConfig(form.experiencePreset, overrides, null)
        : {
            gradientSet: form.gradientSet,
            motionIntensity: form.motionIntensity,
            rankingMotionStyle: form.rankingMotionStyle,
            revealStyle: form.revealStyle,
            tonePreset: form.tonePreset
        };
    const overrideKeys = ["gradientSet", "motionIntensity", "rankingMotionStyle", "revealStyle", "tonePreset"];
    const activeOverrideKeys = form.experiencePreset
        ? overrideKeys.filter((key) => overrides[key] !== undefined && overrides[key] !== presetDefaults?.[key])
        : [];
    const isCustomized = activeOverrideKeys.length > 0;
    const styleOptions = useMemo(() => getQuizExperienceStyleOptions(form), [form]);
    const loadConfig = async () => {
        setLoading(true);
        try {
            const payload = await request("/api/admin/quiz-experience");
            setForm((prev) => ({
                ...prev,
                ...payload.data,
                experienceOverrides: payload.data.experienceOverrides ?? null
            }));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load quiz experience config.");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void loadConfig();
    }, []);
    const save = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const effectiveForSave = form.experiencePreset
                ? resolveQuizExperienceConfig(form.experiencePreset, form.experienceOverrides, null)
                : {
                    gradientSet: form.gradientSet,
                    motionIntensity: form.motionIntensity,
                    rankingMotionStyle: form.rankingMotionStyle,
                    revealStyle: form.revealStyle,
                    tonePreset: form.tonePreset
                };
            const payload = await request("/api/admin/quiz-experience", {
                method: "PUT",
                body: JSON.stringify({
                    ...form,
                    ...effectiveForSave,
                    experienceOverrides: form.experienceOverrides && Object.keys(form.experienceOverrides).length > 0 ? form.experienceOverrides : null
                })
            });
            setForm((prev) => ({
                ...prev,
                ...payload.data,
                experienceOverrides: payload.data.experienceOverrides ?? null
            }));
            setNotice("Saved");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save quiz experience config.");
        }
        finally {
            setSaving(false);
        }
    };
    const applyPreset = (preset) => {
        setForm((prev) => {
            if (!preset) {
                return {
                    ...prev,
                    experiencePreset: null,
                    experienceOverrides: null
                };
            }
            const nextDefaults = QUIZ_EXPERIENCE_PRESETS[preset];
            return {
                ...prev,
                experiencePreset: preset,
                experienceOverrides: null,
                gradientSet: nextDefaults.gradientSet,
                motionIntensity: nextDefaults.motionIntensity,
                rankingMotionStyle: nextDefaults.rankingMotionStyle,
                revealStyle: nextDefaults.revealStyle,
                tonePreset: nextDefaults.tonePreset
            };
        });
    };
    const setOverrideValue = (key, value) => {
        setForm((prev) => {
            if (!prev.experiencePreset) {
                return {
                    ...prev,
                    [key]: value
                };
            }
            const presetValue = QUIZ_EXPERIENCE_PRESETS[prev.experiencePreset][key];
            const nextOverrides = { ...(prev.experienceOverrides ?? {}) };
            if (value === presetValue) {
                delete nextOverrides[key];
            }
            else {
                nextOverrides[key] = value;
            }
            const cleaned = Object.keys(nextOverrides).length > 0 ? nextOverrides : null;
            const resolved = resolveQuizExperienceConfig(prev.experiencePreset, cleaned, null);
            return {
                ...prev,
                experienceOverrides: cleaned,
                gradientSet: resolved.gradientSet,
                motionIntensity: resolved.motionIntensity,
                rankingMotionStyle: resolved.rankingMotionStyle,
                revealStyle: resolved.revealStyle,
                tonePreset: resolved.tonePreset
            };
        });
    };
    const clearOverride = (key) => {
        if (!form.experiencePreset)
            return;
        setOverrideValue(key, QUIZ_EXPERIENCE_PRESETS[form.experiencePreset][key]);
    };
    const resetToPresetDefaults = () => {
        if (!form.experiencePreset)
            return;
        const defaults = QUIZ_EXPERIENCE_PRESETS[form.experiencePreset];
        setForm((prev) => ({
            ...prev,
            experienceOverrides: null,
            gradientSet: defaults.gradientSet,
            motionIntensity: defaults.motionIntensity,
            rankingMotionStyle: defaults.rankingMotionStyle,
            revealStyle: defaults.revealStyle,
            tonePreset: defaults.tonePreset
        }));
    };
    return (_jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]", children: [_jsxs(Card, { children: [_jsx("h2", { className: "mb-4 text-lg font-semibold", children: "Quiz Experience" }), loading && _jsx("p", { className: "mb-2 text-sm text-slate-500", children: "Loading..." }), _jsxs("form", { className: "space-y-3", onSubmit: (event) => void save(event), children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Hook Headline" }), _jsx("input", { className: inputClass, value: form.headline, onChange: (event) => setForm((prev) => ({ ...prev, headline: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Hook Subheadline" }), _jsx("textarea", { className: inputClass, value: form.subheadline, onChange: (event) => setForm((prev) => ({ ...prev, subheadline: event.target.value })) })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Estimated Time" }), _jsx("input", { className: inputClass, value: form.estimatedTimeLabel, onChange: (event) => setForm((prev) => ({ ...prev, estimatedTimeLabel: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Experience Preset" }), _jsxs("select", { className: inputClass, value: form.experiencePreset ?? "", onChange: (event) => applyPreset((event.target.value || null)), children: [_jsx("option", { value: "", children: "Legacy (No Preset)" }), Object.entries(quizExperiencePresetLabels).map(([value, label]) => (_jsx("option", { value: value, children: label }, value)))] })] })] }), _jsxs("div", { className: "rounded-md border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("p", { className: "font-medium text-slate-800", children: ["Preset: ", form.experiencePreset ? quizExperiencePresetLabels[form.experiencePreset] : "Legacy (No Preset)", isCustomized ? " (Customized)" : ""] }), _jsx("p", { className: "mt-1 text-slate-600", children: "Presets configure tone, motion, gradient, and reveal style. You can customize below." }), isCustomized && (_jsx("button", { type: "button", className: "mt-2 text-xs font-medium text-slate-700 underline", onClick: resetToPresetDefaults, children: "Reset to preset defaults" })), _jsxs("div", { className: "mt-2 flex flex-wrap gap-2 text-xs text-slate-700", children: [_jsxs("span", { className: "rounded-full bg-white px-2 py-1", children: ["Gradient: ", effective.gradientSet] }), _jsxs("span", { className: "rounded-full bg-white px-2 py-1", children: ["Motion: ", effective.motionIntensity] }), _jsxs("span", { className: "rounded-full bg-white px-2 py-1", children: ["Results Animation: ", effective.rankingMotionStyle] }), _jsxs("span", { className: "rounded-full bg-white px-2 py-1", children: ["Reveal: ", effective.revealStyle] }), _jsxs("span", { className: "rounded-full bg-white px-2 py-1", children: ["Tone: ", effective.tonePreset] })] })] }), _jsxs("div", { className: "rounded-md border border-slate-200 bg-white p-3", children: [_jsxs("button", { type: "button", className: "text-sm font-medium text-slate-800", onClick: () => setAdvancedOpen((prev) => !prev), children: [advancedOpen ? "Hide" : "Customize", " Experience (Advanced)"] }), advancedOpen && (_jsxs("div", { className: "mt-4 space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800", children: "Visual Style" }), _jsxs("div", { className: "mt-2 grid gap-3 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Gradient Set" }), _jsx("select", { className: inputClass, value: effective.gradientSet, onChange: (event) => setOverrideValue("gradientSet", event.target.value), children: styleOptions.gradientSet.map((value) => (_jsx("option", { value: value, children: value }, value))) }), activeOverrideKeys.includes("gradientSet") && (_jsxs("div", { className: "mt-1 flex items-center gap-2 text-xs", children: [_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-amber-800", children: "Overridden" }), _jsx("button", { type: "button", className: "text-slate-700 underline", onClick: () => clearOverride("gradientSet"), children: "Clear override" })] }))] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Motion Intensity" }), _jsxs("select", { className: inputClass, value: effective.motionIntensity, onChange: (event) => setOverrideValue("motionIntensity", event.target.value), children: [_jsx("option", { value: "LOW", children: "LOW" }), _jsx("option", { value: "MEDIUM", children: "MEDIUM" }), _jsx("option", { value: "HIGH", children: "HIGH" })] }), activeOverrideKeys.includes("motionIntensity") && (_jsxs("div", { className: "mt-1 flex items-center gap-2 text-xs", children: [_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-amber-800", children: "Overridden" }), _jsx("button", { type: "button", className: "text-slate-700 underline", onClick: () => clearOverride("motionIntensity"), children: "Clear override" })] }))] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelClass, children: "Results Animation Style" }), _jsx("select", { className: inputClass, value: effective.rankingMotionStyle, onChange: (event) => setOverrideValue("rankingMotionStyle", event.target.value), children: styleOptions.rankingMotionStyle.map((value) => (_jsx("option", { value: value, children: value }, value))) }), activeOverrideKeys.includes("rankingMotionStyle") && (_jsxs("div", { className: "mt-1 flex items-center gap-2 text-xs", children: [_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-amber-800", children: "Overridden" }), _jsx("button", { type: "button", className: "text-slate-700 underline", onClick: () => clearOverride("rankingMotionStyle"), children: "Clear override" })] }))] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800", children: "Result Presentation" }), _jsxs("div", { className: "mt-2", children: [_jsx("label", { className: labelClass, children: "Result Reveal Experience" }), _jsx("select", { className: inputClass, value: effective.revealStyle, onChange: (event) => setOverrideValue("revealStyle", event.target.value), children: styleOptions.revealStyle.map((value) => (_jsx("option", { value: value, children: value }, value))) }), activeOverrideKeys.includes("revealStyle") && (_jsxs("div", { className: "mt-1 flex items-center gap-2 text-xs", children: [_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-amber-800", children: "Overridden" }), _jsx("button", { type: "button", className: "text-slate-700 underline", onClick: () => clearOverride("revealStyle"), children: "Clear override" })] }))] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800", children: "Tone" }), _jsxs("div", { className: "mt-2", children: [_jsx("label", { className: labelClass, children: "Tone Preset" }), _jsx("select", { className: inputClass, value: effective.tonePreset, onChange: (event) => setOverrideValue("tonePreset", event.target.value), children: styleOptions.tonePreset.map((value) => (_jsx("option", { value: value, children: value }, value))) }), activeOverrideKeys.includes("tonePreset") && (_jsxs("div", { className: "mt-1 flex items-center gap-2 text-xs", children: [_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-amber-800", children: "Overridden" }), _jsx("button", { type: "button", className: "text-slate-700 underline", onClick: () => clearOverride("tonePreset"), children: "Clear override" })] }))] })] })] }))] }), !form.experiencePreset && (_jsx("div", { className: "rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900", children: "Legacy mode is active. Choose an Experience Preset to manage style using preset defaults + advanced overrides." })), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Intro Media Prompt (optional)" }), _jsx("textarea", { className: inputClass, value: form.introMediaPrompt ?? "", onChange: (event) => setForm((prev) => ({ ...prev, introMediaPrompt: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Reveal Media Prompt (optional)" }), _jsx("textarea", { className: inputClass, value: form.revealMediaPrompt ?? "", onChange: (event) => setForm((prev) => ({ ...prev, revealMediaPrompt: event.target.value })) })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { type: "submit", disabled: saving, children: saving ? "Saving..." : "Save Quiz Experience" }), notice && _jsx("span", { className: "text-sm text-emerald-700", children: notice }), error && _jsx("span", { className: "text-sm text-red-700", children: error })] })] })] }), _jsxs(Card, { children: [_jsx("h3", { className: "mb-3 text-lg font-semibold", children: "Live Preview" }), _jsxs("div", { className: "rounded-xl bg-gradient-to-br from-orange-200 via-amber-100 to-rose-100 p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate-700", children: form.estimatedTimeLabel }), _jsx("h4", { className: "mt-2 text-xl font-semibold text-slate-900", children: form.headline }), _jsx("p", { className: "mt-2 text-sm text-slate-700", children: form.subheadline }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2 text-xs text-slate-700", children: [_jsxs("span", { className: "rounded-full bg-white/80 px-2 py-1", children: ["Tone: ", effective.tonePreset] }), _jsxs("span", { className: "rounded-full bg-white/80 px-2 py-1", children: ["Motion: ", effective.motionIntensity] }), _jsxs("span", { className: "rounded-full bg-white/80 px-2 py-1", children: ["Reveal: ", effective.revealStyle] })] })] })] })] }));
}
const rootElement = document.getElementById("root");
const isTestRuntime = import.meta.env.MODE === "test";
if (rootElement && !isTestRuntime) {
    const routerFuture = {
        v7_relativeSplatPath: true,
        ...{ v7_startTransition: true }
    };
    const root = rootElement._adminRoot ??
        (rootElement._adminRoot =
            ReactDOM.createRoot(rootElement));
    root.render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { future: routerFuture, children: _jsx(ShellLayout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/traits", replace: true }) }), _jsx(Route, { path: "/traits", element: _jsx(TraitsPage, {}) }), _jsx(Route, { path: "/programs", element: _jsx(ProgramsPage, {}) }), _jsx(Route, { path: "/brand-voice", element: _jsx(BrandVoicePage, {}) }), _jsx(Route, { path: "/quiz-experience", element: _jsx(QuizExperiencePage, {}) }), _jsx(Route, { path: "/widget/branding", element: _jsx(WidgetBrandingPage, {}) }), _jsx(Route, { path: "/widget/embed", element: _jsx(AdminWidgetEmbedPage, {}) }), _jsx(Route, { path: "/widget/preview", element: _jsx(AdminWidgetPreviewPage, {}) }), _jsx(Route, { path: "/widget/orchestration", element: _jsx(AdminWidgetOrchestrationPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/traits", replace: true }) })] }) }) }) }) }));
}

import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { programTraitPriorityBuckets, brandVoiceAvoidFlagOptions, brandVoiceStyleFlagOptions, boardStateToProgramTraitRows, defaultAvoidFlags, defaultStyleFlags, defaultToneProfile, generateBrandVoicePreview, traitCategories } from "@pmm/domain";
import { AppShell, Button, Card } from "@pmm/ui";
import { BrandVoicePreview } from "./components/brand-voice/BrandVoicePreview";
import { ChipSelectWithCustom } from "./components/brand-voice/ChipSelectWithCustom";
import { GeneratedSamplesPanel } from "./components/brand-voice/GeneratedSamplesPanel";
import { SimulationLab } from "./components/brand-voice/SimulationLab";
import { ToneSelector } from "./components/brand-voice/ToneSelector";
import { ToneSliders } from "./components/brand-voice/ToneSliders";
import { TraitPickerModal } from "./components/trait-picker/TraitPickerModal";
import { createEmptyProgramBoardState, isBoardDirty, moveTraitInBoard, removeTraitFromBoard, toBoardIdState } from "./program-board-state";
import "./styles.css";
const queryClient = new QueryClient();
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const navLinkClass = "rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-200";
const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600";
const subtleButtonClass = "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50";
const openAiVoiceOptions = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
async function request(path, init) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...init
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorPayload = data?.error;
        if (typeof errorPayload === "string") {
            throw new Error(errorPayload);
        }
        if (errorPayload && typeof errorPayload === "object" && typeof errorPayload.message === "string") {
            throw new Error(errorPayload.message);
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
    definition: "",
    rubricPositiveSignals: "",
    rubricNegativeSignals: "",
    rubricFollowUps: ""
};
function toTraitFormState(trait) {
    return {
        name: trait.name,
        category: trait.category,
        definition: trait.definition ?? "",
        rubricPositiveSignals: trait.rubricPositiveSignals ?? "",
        rubricNegativeSignals: trait.rubricNegativeSignals ?? "",
        rubricFollowUps: trait.rubricFollowUps ?? ""
    };
}
function FieldMeta({ value }) {
    const hint = qualityHint(value);
    return (_jsxs("div", { className: "mt-1 flex items-center justify-between text-xs", children: [_jsxs("span", { className: "text-slate-500", children: [value.length, " characters"] }), _jsx("span", { className: hint.className, children: hint.label })] }));
}
function CollapsibleSection({ title, defaultOpen = true, children }) {
    return (_jsxs("details", { open: defaultOpen, className: "rounded-md border border-slate-200 bg-slate-50/50", children: [_jsx("summary", { className: "cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-800", children: title }), _jsx("div", { className: "space-y-3 border-t border-slate-200 bg-white p-3", children: children })] }));
}
function ListBuilder({ label, items, placeholder, onChange, emptyText, suggestionButtonLabel, onSuggestion }) {
    const [draft, setDraft] = useState("");
    const addItem = () => {
        const next = draft.trim();
        if (!next) {
            return;
        }
        onChange([...items, next]);
        setDraft("");
    };
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("label", { className: labelClass, children: label }), suggestionButtonLabel && onSuggestion && (_jsx("button", { type: "button", className: subtleButtonClass, onClick: onSuggestion, children: suggestionButtonLabel }))] }), _jsxs("div", { className: "space-y-2", children: [items.length === 0 && _jsx("p", { className: "text-xs text-slate-500", children: emptyText }), items.map((item, index) => (_jsxs("div", { className: "flex items-start gap-2", children: [_jsx("input", { className: inputClass, value: item, onChange: (event) => {
                                    const next = [...items];
                                    next[index] = event.target.value;
                                    onChange(next);
                                } }), _jsx("button", { type: "button", className: "mt-2 text-xs text-red-700 underline", onClick: () => onChange(items.filter((_, itemIndex) => itemIndex !== index)), children: "Remove" })] }, `${label}-${index}`))), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { className: inputClass, placeholder: placeholder, value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addItem();
                                    }
                                } }), _jsx(Button, { type: "button", onClick: addItem, children: "Add" })] })] })] }));
}
function ShellLayout({ children }) {
    return (_jsxs(AppShell, { children: [_jsx("header", { className: "border-b border-slate-200 bg-white", children: _jsxs("div", { className: "mx-auto flex max-w-7xl items-center justify-between p-4", children: [_jsx("h1", { className: "text-xl font-semibold", children: "Program Match Admin" }), _jsxs("nav", { className: "flex gap-2", children: [_jsx(Link, { className: navLinkClass, to: "/traits", children: "Traits" }), _jsx(Link, { className: navLinkClass, to: "/programs", children: "Programs" }), _jsx(Link, { className: navLinkClass, to: "/brand-voice", children: "Brand Voice" })] })] }) }), _jsx("main", { className: "mx-auto max-w-7xl p-4", children: children })] }));
}
function TraitsPage() {
    const [traits, setTraits] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [selectedTraitId, setSelectedTraitId] = useState(null);
    const [form, setForm] = useState({ ...emptyTraitForm });
    const [baselineForm, setBaselineForm] = useState({ ...emptyTraitForm });
    const [questionForm, setQuestionForm] = useState({
        id: "",
        prompt: "",
        type: "chat",
        optionsText: ""
    });
    const [traitNotice, setTraitNotice] = useState(null);
    const [traitError, setTraitError] = useState(null);
    const positiveSignals = useMemo(() => splitListText(form.rubricPositiveSignals), [form.rubricPositiveSignals]);
    const negativeSignals = useMemo(() => splitListText(form.rubricNegativeSignals), [form.rubricNegativeSignals]);
    const quizOptions = useMemo(() => splitListText(questionForm.optionsText), [questionForm.optionsText]);
    const traitFormDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baselineForm), [form, baselineForm]);
    const selectedTrait = traits.find((trait) => trait.id === selectedTraitId) ?? null;
    const isEditing = Boolean(selectedTraitId && selectedTrait);
    const loadTraits = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (search.trim()) {
                query.set("q", search.trim());
            }
            if (categoryFilter !== "ALL") {
                query.set("category", categoryFilter);
            }
            const payload = await request(`/api/admin/traits?${query.toString()}`);
            setTraits(payload.data);
            if (payload.data.length === 0) {
                setSelectedTraitId(null);
            }
            else if (selectedTraitId && !payload.data.some((trait) => trait.id === selectedTraitId)) {
                setSelectedTraitId(payload.data[0]?.id ?? null);
            }
        }
        finally {
            setLoading(false);
        }
    };
    const loadQuestions = async (traitId) => {
        const payload = await request(`/api/admin/traits/${traitId}/questions`);
        setQuestions(payload.data);
    };
    useEffect(() => {
        void loadTraits();
    }, [search, categoryFilter]);
    useEffect(() => {
        if (!selectedTraitId) {
            setQuestions([]);
            return;
        }
        void loadQuestions(selectedTraitId);
    }, [selectedTraitId]);
    const canLeaveTraitForm = () => {
        if (!traitFormDirty) {
            return true;
        }
        return window.confirm("You have unsaved trait changes. Discard them and continue?");
    };
    const startCreateTrait = () => {
        if (!canLeaveTraitForm()) {
            return;
        }
        setSelectedTraitId(null);
        setForm({ ...emptyTraitForm });
        setBaselineForm({ ...emptyTraitForm });
        setQuestionForm({ id: "", prompt: "", type: "chat", optionsText: "" });
        setTraitNotice(null);
        setTraitError(null);
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
    };
    const resetTraitForm = () => {
        if (selectedTrait) {
            const nextForm = toTraitFormState(selectedTrait);
            setForm(nextForm);
            setBaselineForm(nextForm);
            return;
        }
        setForm({ ...emptyTraitForm });
        setBaselineForm({ ...emptyTraitForm });
    };
    const submitTrait = async (event) => {
        event.preventDefault();
        setTraitError(null);
        setTraitNotice(null);
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
                setTraitNotice("Trait saved.");
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
                setTraitNotice("Trait created.");
            }
            await loadTraits();
            if (selectedTraitId) {
                await loadQuestions(selectedTraitId);
            }
        }
        catch (error) {
            setTraitError(error instanceof Error ? error.message : "Failed to save trait.");
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
    const submitQuestion = async (event) => {
        event.preventDefault();
        if (!selectedTraitId) {
            return;
        }
        const body = {
            prompt: questionForm.prompt,
            type: questionForm.type,
            options: questionForm.type === "quiz"
                ? questionForm.optionsText
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                : undefined
        };
        if (questionForm.id) {
            await request(`/api/admin/questions/${questionForm.id}`, {
                method: "PUT",
                body: JSON.stringify(body)
            });
        }
        else {
            await request(`/api/admin/traits/${selectedTraitId}/questions`, {
                method: "POST",
                body: JSON.stringify(body)
            });
        }
        setQuestionForm({
            id: "",
            prompt: "",
            type: "chat",
            optionsText: ""
        });
        await loadQuestions(selectedTraitId);
    };
    const deleteQuestion = async (id) => {
        await request(`/api/admin/questions/${id}`, { method: "DELETE" });
        if (selectedTraitId) {
            await loadQuestions(selectedTraitId);
        }
    };
    return (_jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px_1fr_1fr]", children: [_jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-lg font-semibold", children: "Traits Library" }), _jsxs("div", { className: "space-y-2", children: [_jsx("button", { type: "button", className: `${subtleButtonClass} w-full`, onClick: startCreateTrait, children: "+ New Trait" }), _jsx("input", { className: inputClass, placeholder: "Search traits...", value: search, onChange: (event) => setSearch(event.target.value) }), _jsxs("select", { className: inputClass, value: categoryFilter, onChange: (event) => setCategoryFilter(event.target.value), children: [_jsx("option", { value: "ALL", children: "All categories" }), traitCategories.map((category) => (_jsx("option", { value: category, children: category }, category)))] })] }), _jsxs("div", { className: "mt-4 space-y-2", children: [loading && _jsx("p", { className: "text-sm text-slate-500", children: "Loading..." }), !loading && traits.length === 0 && _jsx("p", { className: "text-sm text-slate-500", children: "No traits yet. Create your first trait." }), traits.map((trait) => (_jsxs("button", { type: "button", onClick: () => startEditTrait(trait), className: `w-full rounded-md border p-2 text-left text-sm ${selectedTraitId === trait.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`, children: [_jsx("div", { className: "font-semibold", children: trait.name }), _jsx("div", { className: "text-xs text-slate-500", children: trait.category })] }, trait.id)))] })] }), _jsxs(Card, { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold", children: isEditing ? `Edit Trait: ${selectedTrait?.name ?? ""}` : "Create New Trait" }), _jsx("p", { className: "text-xs text-slate-500", children: isEditing ? "Editing existing trait" : "Creating a new trait" })] }), selectedTrait && (_jsx("div", { className: "flex gap-2", children: _jsx("button", { type: "button", className: "text-xs text-red-700 underline", onClick: () => void deleteTrait(selectedTrait.id), children: "Delete trait" }) }))] }), _jsxs("form", { className: "space-y-3", onSubmit: (event) => void submitTrait(event), children: [_jsxs(CollapsibleSection, { title: "Basics", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Name" }), _jsx("input", { required: true, className: inputClass, value: form.name, onChange: (event) => setForm((prev) => ({ ...prev, name: event.target.value })) }), _jsx(FieldMeta, { value: form.name })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Category" }), _jsx("select", { className: inputClass, value: form.category, onChange: (event) => setForm((prev) => ({ ...prev, category: event.target.value })), children: traitCategories.map((category) => (_jsx("option", { value: category, children: category }, category))) })] }), _jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("label", { className: labelClass, children: "Definition" }), _jsx("button", { type: "button", className: subtleButtonClass, onClick: () => setForm((prev) => ({
                                                            ...prev,
                                                            definition: buildDefinitionDraft(prev.name, prev.category)
                                                        })), children: "AI Draft Definition" })] }), _jsx("textarea", { className: inputClass, value: form.definition, onChange: (event) => setForm((prev) => ({ ...prev, definition: event.target.value })) }), _jsx(FieldMeta, { value: form.definition })] })] }), _jsxs(CollapsibleSection, { title: "Rubric Signals", children: [_jsx(ListBuilder, { label: "Positive Signals", items: positiveSignals, placeholder: "Add a positive signal", emptyText: "No positive signals yet.", suggestionButtonLabel: "Generate 3 positive signals", onSuggestion: () => setForm((prev) => ({
                                            ...prev,
                                            rubricPositiveSignals: joinListText(buildSignalSuggestions("positive", prev.name))
                                        })), onChange: (items) => setForm((prev) => ({ ...prev, rubricPositiveSignals: joinListText(items) })) }), _jsx(ListBuilder, { label: "Negative Signals", items: negativeSignals, placeholder: "Add a negative signal", emptyText: "No negative signals yet.", suggestionButtonLabel: "Generate 3 negative signals", onSuggestion: () => setForm((prev) => ({
                                            ...prev,
                                            rubricNegativeSignals: joinListText(buildSignalSuggestions("negative", prev.name))
                                        })), onChange: (items) => setForm((prev) => ({ ...prev, rubricNegativeSignals: joinListText(items) })) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", children: isEditing ? "Save Changes" : "Create Trait" }), _jsx("button", { type: "button", className: "text-sm underline", onClick: resetTraitForm, children: "Reset" })] }), traitNotice && _jsx("p", { className: "text-sm text-emerald-700", children: traitNotice }), traitError && _jsx("p", { className: "text-sm text-red-700", children: traitError })] })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-lg font-semibold", children: "Trait Questions" }), !selectedTrait ? (_jsx("p", { className: "text-sm text-slate-500", children: "Select a trait to manage questions after creating it." })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "mb-3 text-sm text-slate-600", children: selectedTrait.name }), _jsxs("form", { className: "space-y-3", onSubmit: (event) => void submitQuestion(event), children: [_jsxs(CollapsibleSection, { title: "Question Details", children: [_jsx("p", { className: "mb-2 text-xs text-slate-500", children: "Questions elicit evidence. Scoring is based on the trait's rubric signals." }), _jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("label", { className: labelClass, children: "Prompt" }), _jsx("button", { type: "button", className: subtleButtonClass, onClick: () => setQuestionForm((prev) => ({
                                                                    ...prev,
                                                                    prompt: buildQuestionPromptDraft(selectedTrait, prev.type)
                                                                })), children: "AI Draft Prompt" })] }), _jsx("textarea", { required: true, className: inputClass, value: questionForm.prompt, onChange: (event) => setQuestionForm((prev) => ({ ...prev, prompt: event.target.value })) }), _jsx(FieldMeta, { value: questionForm.prompt })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Type" }), _jsxs("select", { className: inputClass, value: questionForm.type, onChange: (event) => setQuestionForm((prev) => ({ ...prev, type: event.target.value })), children: [_jsx("option", { value: "chat", children: "Chat" }), _jsx("option", { value: "quiz", children: "Quiz" })] })] })] }), questionForm.type === "quiz" && (_jsx(CollapsibleSection, { title: "Quiz Options", defaultOpen: false, children: _jsx(ListBuilder, { label: "Options", items: quizOptions, placeholder: "Add a quiz option", emptyText: "No options yet.", onChange: (items) => setQuestionForm((prev) => ({ ...prev, optionsText: joinListText(items) })) }) })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", children: questionForm.id ? "Save Question" : "Add Question" }), _jsx("button", { type: "button", className: "text-sm underline", onClick: () => setQuestionForm({ id: "", prompt: "", type: "chat", optionsText: "" }), children: "Reset" })] })] }), _jsx("div", { className: "mt-4 space-y-2", children: questions.map((question) => (_jsxs("div", { className: "rounded-md border border-slate-200 p-2", children: [_jsx("div", { className: "text-xs text-slate-500", children: question.type.toUpperCase() }), _jsx("div", { className: "text-sm font-medium", children: question.prompt }), question.options.length > 0 && _jsxs("div", { className: "text-xs text-slate-600", children: ["Options: ", question.options.join(", ")] }), _jsxs("div", { className: "mt-2 flex gap-2 text-xs", children: [_jsx("button", { type: "button", className: "underline", onClick: () => setQuestionForm({
                                                        id: question.id,
                                                        prompt: question.prompt,
                                                        type: question.type,
                                                        optionsText: question.options.join("\n")
                                                    }), children: "Edit" }), _jsx("button", { type: "button", className: "text-red-700 underline", onClick: () => void deleteQuestion(question.id), children: "Delete" })] })] }, question.id))) })] }))] })] }));
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
        department: ""
    });
    const [traitModalOpen, setTraitModalOpen] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newProgramDraft, setNewProgramDraft] = useState({ name: "", degreeLevel: "", department: "" });
    const [isCreatingSubmitting, setIsCreatingSubmitting] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [removingTrait, setRemovingTrait] = useState(null);
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
    const [expandedBuckets, setExpandedBuckets] = useState(() => new Set(["CRITICAL", "VERY_IMPORTANT", "IMPORTANT"]));
    const cancelRemoveButtonRef = useRef(null);
    const confirmRemoveButtonRef = useRef(null);
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
            programForm.department !== (selectedProgram.department ?? ""));
    }, [selectedProgram, programForm]);
    const pageDirty = programDirty || boardDirty;
    const [saveStatus, setSaveStatus] = useState("idle");
    const [saveError, setSaveError] = useState(null);
    const loadPrograms = async () => {
        const payload = await request("/api/admin/programs");
        setPrograms(payload.data);
        if (payload.data.length > 0 && !payload.data.some((program) => program.id === selectedProgramId)) {
            setSelectedProgramId(payload.data[0]?.id ?? null);
        }
        if (payload.data.length === 0) {
            setSelectedProgramId(null);
            const empty = createEmptyProgramBoardState();
            setBoard(empty);
            setSavedBoard(empty);
        }
    };
    const loadTraits = async () => {
        const payload = await request("/api/admin/traits");
        setTraits(payload.data);
    };
    const loadProgramTraits = async (programId) => {
        const payload = await request(`/api/admin/programs/${programId}/traits`);
        const nextState = createEmptyProgramBoardState();
        for (const item of payload.data) {
            nextState[item.bucket].push(item.trait);
        }
        setBoard(nextState);
        setSavedBoard(nextState);
    };
    useEffect(() => {
        void Promise.all([loadPrograms(), loadTraits()]);
    }, []);
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
            setProgramForm({ name: "", description: "", degreeLevel: "", department: "" });
            return;
        }
        setProgramForm({
            name: selectedProgram.name,
            description: selectedProgram.description ?? "",
            degreeLevel: selectedProgram.degreeLevel ?? "",
            department: selectedProgram.department ?? ""
        });
    }, [selectedProgram]);
    const createProgram = async (event) => {
        event.preventDefault();
        const payload = await request("/api/admin/programs", {
            method: "POST",
            body: JSON.stringify(programForm)
        });
        await loadPrograms();
        setSelectedProgramId(payload.data.id);
    };
    const startNewProgram = () => {
        setIsCreatingNew(true);
        setNewProgramDraft({ name: "", degreeLevel: "", department: "" });
        setCreateError(null);
    };
    const cancelNewProgram = () => {
        setIsCreatingNew(false);
        setCreateError(null);
    };
    const createProgramFromDraft = async (event) => {
        event.preventDefault();
        if (!newProgramDraft.name.trim() || !newProgramDraft.degreeLevel.trim() || !newProgramDraft.department.trim()) {
            setCreateError("Name, Degree Level, and Department are required.");
            return;
        }
        setCreateError(null);
        setIsCreatingSubmitting(true);
        try {
            const payload = await request("/api/admin/programs", {
                method: "POST",
                body: JSON.stringify({
                    name: newProgramDraft.name.trim(),
                    description: "",
                    degreeLevel: newProgramDraft.degreeLevel.trim(),
                    department: newProgramDraft.department.trim()
                })
            });
            await loadPrograms();
            setSelectedProgramId(payload.data.id);
            setIsCreatingNew(false);
            setNewProgramDraft({ name: "", degreeLevel: "", department: "" });
        }
        catch (error) {
            setCreateError(error instanceof Error ? error.message : "Failed to create program.");
        }
        finally {
            setIsCreatingSubmitting(false);
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
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [pageDirty && (_jsx("span", { className: "text-sm font-medium text-amber-700", role: "status", children: "Unsaved changes" })), saveStatus === "saving" && (_jsx("span", { className: "text-sm text-slate-500", role: "status", children: "Saving..." })), saveStatus === "saved" && (_jsx("span", { className: "text-sm text-emerald-700", role: "status", children: "All changes saved" })), saveStatus === "error" && saveError && (_jsx("span", { className: "text-sm text-red-700", role: "alert", children: saveError }))] }), _jsx(Button, { type: "button", onClick: () => void saveAllChanges(), disabled: !pageDirty || saveStatus === "saving", children: "Save Changes" })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[280px_320px_1fr]", children: [_jsxs(Card, { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Programs" }), _jsx("button", { type: "button", onClick: startNewProgram, disabled: isCreatingNew, className: "rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50", children: "+ New Program" })] }), _jsxs("div", { className: "space-y-2", children: [isCreatingNew && (_jsxs("form", { onSubmit: (e) => void createProgramFromDraft(e), className: "rounded-md border border-slate-200 bg-slate-50/80 p-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Name" }), _jsx("input", { required: true, className: inputClass, placeholder: "Program name", value: newProgramDraft.name, onChange: (e) => setNewProgramDraft((prev) => ({ ...prev, name: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Degree Level" }), _jsx("input", { required: true, className: inputClass, placeholder: "e.g. Bachelor's", value: newProgramDraft.degreeLevel, onChange: (e) => setNewProgramDraft((prev) => ({ ...prev, degreeLevel: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Department" }), _jsx("input", { required: true, className: inputClass, placeholder: "e.g. Engineering", value: newProgramDraft.department, onChange: (e) => setNewProgramDraft((prev) => ({ ...prev, department: e.target.value })) })] })] }), createError && _jsx("p", { className: "mt-2 text-sm text-red-700", role: "alert", children: createError }), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsx(Button, { type: "submit", disabled: isCreatingSubmitting, children: isCreatingSubmitting ? "Creating..." : "Create" }), _jsx("button", { type: "button", onClick: cancelNewProgram, disabled: isCreatingSubmitting, className: subtleButtonClass, children: "Cancel" })] })] })), programs.length === 0 && !isCreatingNew && (_jsx("p", { className: "text-sm text-slate-500", children: "No programs yet. Create one to begin." })), programs.map((program) => (_jsxs("button", { type: "button", onClick: () => setSelectedProgramId(program.id), className: `w-full rounded-md border p-2 text-left text-sm ${selectedProgramId === program.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`, children: [_jsx("div", { className: "font-semibold", children: program.name }), program.department && _jsx("div", { className: "text-xs text-slate-500", children: program.department })] }, program.id)))] })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-lg font-semibold", children: selectedProgram ? "Edit Program" : "Create Program" }), _jsxs("form", { className: "space-y-3", onSubmit: (event) => {
                                    event.preventDefault();
                                    if (selectedProgram)
                                        return;
                                    void createProgram(event);
                                }, children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Name" }), _jsx("input", { required: true, className: inputClass, value: programForm.name, onChange: (event) => setProgramForm((prev) => ({ ...prev, name: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Description" }), _jsx("textarea", { className: inputClass, value: programForm.description, onChange: (event) => setProgramForm((prev) => ({ ...prev, description: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Degree Level" }), _jsx("input", { className: inputClass, value: programForm.degreeLevel, onChange: (event) => setProgramForm((prev) => ({ ...prev, degreeLevel: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Department" }), _jsx("input", { className: inputClass, value: programForm.department, onChange: (event) => setProgramForm((prev) => ({ ...prev, department: event.target.value })) })] }), _jsxs("div", { className: "flex gap-2", children: [!selectedProgram && _jsx(Button, { type: "submit", children: "Create Program" }), selectedProgram && (_jsx("button", { type: "button", className: "text-sm text-red-700 underline", onClick: () => void deleteProgram(selectedProgram.id), children: "Delete" }))] })] })] }), _jsxs(Card, { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Trait Priority Board" }), _jsx("button", { type: "button", className: `${subtleButtonClass} disabled:cursor-not-allowed disabled:opacity-50`, onClick: () => setTraitModalOpen(true), disabled: !selectedProgram, children: "Add Trait" })] }), !selectedProgram ? (_jsx("p", { className: "text-sm text-slate-500", children: "Select a program to edit board priorities." })) : (_jsx("div", { className: "flex max-h-[32rem] flex-col gap-4 overflow-y-auto pr-1", children: programTraitPriorityBuckets.map((bucket) => {
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
                                                        }, className: "group rounded-md border border-slate-300 bg-white p-2 text-sm transition hover:border-slate-400 hover:bg-slate-50", children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-2", children: [_jsx("button", { type: "button", className: "mt-0.5 cursor-grab rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700", title: "Drag trait", "aria-label": `Drag ${trait.name}`, children: "::" }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate font-medium", children: trait.name }), _jsx("div", { className: "text-xs text-slate-500", children: trait.category })] })] }), _jsx("button", { type: "button", className: "rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100", "aria-label": `Remove ${trait.name} from board`, onClick: () => openRemoveDialog(trait), children: "x" })] }) }, trait.id)))] }))] }, bucket));
                                }) })), removeDialogOpen && removingTrait && (_jsx("div", { className: "fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4", role: "presentation", children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "remove-trait-title", "aria-describedby": "remove-trait-body", className: "w-full max-w-md rounded-md bg-white p-4 shadow-lg", onKeyDown: onRemoveDialogKeyDown, children: [_jsx("h3", { id: "remove-trait-title", className: "text-lg font-semibold", children: "Remove trait from this program?" }), _jsx("p", { id: "remove-trait-body", className: "mt-2 text-sm text-slate-600", children: "This will remove the trait from the priority board for this program. It will not delete the trait from the library." }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { type: "button", className: subtleButtonClass, autoFocus: true, ref: cancelRemoveButtonRef, onClick: cancelRemoveTrait, "aria-label": "Cancel trait removal", children: "Cancel" }), _jsx("button", { type: "button", className: "rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800", ref: confirmRemoveButtonRef, onClick: confirmRemoveTrait, "aria-label": `Remove ${removingTrait.name} from board`, children: "Remove" })] })] }) })), _jsx(TraitPickerModal, { isOpen: traitModalOpen, onClose: () => setTraitModalOpen(false), traits: traits, assignedTraitIds: assignedTraitIds, programId: selectedProgram?.id ?? null, degreeLevel: selectedProgram?.degreeLevel ?? null, department: selectedProgram?.department ?? null, onAddTraits: addTraitsToBoard })] })] })] }));
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
        try {
            await request(`/api/admin/brand-voices/${selectedVoiceId}`, {
                method: "PUT",
                body: JSON.stringify({
                    ...form,
                    canonicalExamples: form.canonicalExamples.filter((item) => item.pinned)
                })
            });
            await loadVoices();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save brand voice");
        }
    };
    const deleteVoice = async (id) => {
        await request(`/api/admin/brand-voices/${id}`, { method: "DELETE" });
        await loadVoices();
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
        setActiveTab("configuration");
    };
    return (_jsxs("div", { className: "grid gap-4 lg:grid-cols-[260px_1fr]", children: [_jsxs(Card, { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Brand Voices" }), _jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50", onClick: startNewVoice, children: "New" })] }), _jsx("div", { className: "space-y-2", children: voices.map((voice) => (_jsxs("button", { type: "button", onClick: () => setSelectedVoiceId(voice.id), className: `w-full rounded-md border p-2 text-left text-sm ${selectedVoiceId === voice.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`, children: [_jsx("div", { className: "font-semibold", children: voice.name }), _jsx("div", { className: "text-xs text-slate-500", children: voice.primaryTone })] }, voice.id))) })] }), _jsxs(Card, { children: [_jsx("h2", { className: "mb-3 text-lg font-semibold", children: selectedVoice ? "Edit Brand Voice" : "Create Brand Voice" }), _jsxs("div", { className: "mb-4 flex gap-2", children: [_jsx("button", { type: "button", className: `rounded-md border px-3 py-1.5 text-sm font-medium ${activeTab === "configuration" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`, onClick: () => setActiveTab("configuration"), children: "Configuration" }), _jsx("button", { type: "button", className: `rounded-md border px-3 py-1.5 text-sm font-medium ${activeTab === "simulation" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`, onClick: () => setActiveTab("simulation"), children: "Simulation Lab" })] }), activeTab === "configuration" ? (_jsxs("form", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]", onSubmit: (event) => void (selectedVoice ? saveVoice(event) : createVoice(event)), children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Name" }), _jsx("input", { required: true, className: inputClass, value: form.name, onChange: (event) => setForm((prev) => ({ ...prev, name: event.target.value })) })] }), _jsx(ToneSelector, { primaryTone: form.primaryTone, modifiers: form.toneModifiers, onPrimaryToneChange: (primaryTone) => setForm((prev) => ({ ...prev, primaryTone })), onModifiersChange: (toneModifiers) => setForm((prev) => ({ ...prev, toneModifiers })) }), _jsx(ToneSliders, { value: form.toneProfile, onChange: (toneProfile) => setForm((prev) => ({ ...prev, toneProfile })) }), _jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsx("h3", { className: "mb-2 text-sm font-semibold", children: "Voice (OpenAI TTS)" }), _jsx("label", { className: labelClass, children: "Preferred voice" }), _jsx("div", { className: "flex flex-wrap gap-2", children: openAiVoiceOptions.map((voice) => (_jsx("button", { type: "button", className: `rounded-md border px-3 py-1.5 text-sm font-medium ${form.ttsVoiceName === voice
                                                        ? "border-slate-900 bg-slate-900 text-white"
                                                        : "border-slate-300 text-slate-700 hover:bg-slate-50"}`, onClick: () => {
                                                        setForm((prev) => ({ ...prev, ttsVoiceName: voice }));
                                                        setVoiceTestUrl(null);
                                                        void testVoice(voice);
                                                    }, disabled: isTestingVoice || voiceTestText.trim().length === 0, children: isTestingVoice && form.ttsVoiceName === voice ? `Sampling ${voice}...` : voice }, `preferred-voice-${voice}`))) }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "This voice is used for simulation voice samples unless overridden." }), voiceTestUrl && (_jsx("audio", { className: "mt-2 block w-full max-w-full", controls: true, preload: "metadata", src: voiceTestUrl }, voiceTestUrl))] }), _jsx(ChipSelectWithCustom, { label: "Voice Behaviors", options: [...brandVoiceStyleFlagOptions], value: form.styleFlags, onChange: (styleFlags) => setForm((prev) => ({ ...prev, styleFlags })), addPlaceholder: "Add custom behavior" }), _jsx(ChipSelectWithCustom, { label: "Avoid", options: [...brandVoiceAvoidFlagOptions], value: form.avoidFlags, onChange: (avoidFlags) => setForm((prev) => ({ ...prev, avoidFlags })), addPlaceholder: "Add custom avoid rule" }), _jsx(CollapsibleSection, { title: "Canonical Examples", defaultOpen: false, children: _jsxs("div", { className: "space-y-2", children: [form.canonicalExamples.length === 0 && _jsx("p", { className: "text-xs text-slate-500", children: "No pinned examples yet." }), form.canonicalExamples.map((example) => (_jsxs("div", { className: "rounded border border-slate-200 p-2 text-sm", children: [_jsx("div", { className: "mb-1 text-[11px] uppercase tracking-wide text-slate-500", children: example.type }), _jsx("div", { children: example.text })] }, example.id)))] }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", children: selectedVoice ? "Save Brand Voice" : "Create Brand Voice" }), selectedVoice && (_jsx("button", { type: "button", className: "text-sm text-red-700 underline", onClick: () => void deleteVoice(selectedVoice.id), children: "Delete" }))] }), error && _jsx("p", { className: "text-sm text-red-700", children: error })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Use my own seed text" }), _jsx("input", { className: inputClass, value: seedText, onChange: (event) => setSeedText(event.target.value) })] }), _jsx(BrandVoicePreview, { title: "Live Preview", samples: preview }), _jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold", children: "Test Voice" }), _jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void testVoice(), disabled: isTestingVoice || voiceTestText.trim().length === 0, children: isTestingVoice ? "Testing..." : "Test voice" })] }), _jsx("label", { className: labelClass, children: "Sample script" }), _jsx("textarea", { className: inputClass, rows: 3, value: voiceTestText, onChange: (event) => setVoiceTestText(event.target.value), placeholder: "Enter short script to synthesize voice" }), voiceTestUrl && (_jsxs("div", { className: "mt-2 min-w-0 rounded border border-slate-200 p-2", children: [_jsx("a", { className: "block break-all text-xs text-blue-700 underline", href: voiceTestUrl, target: "_blank", rel: "noreferrer", children: "Open tested audio" }), _jsx("audio", { className: "mt-2 block w-full max-w-full", controls: true, preload: "metadata", src: voiceTestUrl })] }))] }), _jsxs("div", { className: "rounded-md border border-slate-200 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold", children: "Generate Sample Language" }), _jsx("button", { type: "button", className: "rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60", onClick: () => void generateSamples(), disabled: !selectedVoiceId || isGenerating, children: isGenerating ? "Generating..." : "Generate Sample Language" })] }), !selectedVoiceId && (_jsx("p", { className: "text-xs text-slate-500", children: "Create this brand voice first, then generate AI suggestions." }))] }), generatedSamples && (_jsx(GeneratedSamplesPanel, { samples: generatedSamples, onPin: pinExample, onReplacePreview: (type, text) => setPreviewOverride((prev) => ({
                                            ...prev,
                                            [type]: text
                                        })) }))] })] })) : (_jsx(SimulationLab, { brandVoiceId: selectedVoiceId, request: request }))] })] }));
}
const rootElement = document.getElementById("root");
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { children: _jsx(ShellLayout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/traits", replace: true }) }), _jsx(Route, { path: "/traits", element: _jsx(TraitsPage, {}) }), _jsx(Route, { path: "/programs", element: _jsx(ProgramsPage, {}) }), _jsx(Route, { path: "/brand-voice", element: _jsx(BrandVoicePage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/traits", replace: true }) })] }) }) }) }) }));
}

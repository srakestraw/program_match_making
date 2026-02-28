import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrandVoiceSampleType,
  CanonicalExample,
  ToneProfile,
  ProgramTraitPriorityBucket,
  programTraitPriorityBuckets,
  TraitCategory,
  brandVoiceAvoidFlagOptions,
  brandVoiceStyleFlagOptions,
  boardStateToProgramTraitRows,
  defaultAvoidFlags,
  defaultStyleFlags,
  defaultToneProfile,
  generateBrandVoicePreview,
  traitCategories
} from "@pmm/domain";
import { AppShell, Button, Card } from "@pmm/ui";
import { BrandVoicePreview } from "./components/brand-voice/BrandVoicePreview";
import { ChipSelectWithCustom } from "./components/brand-voice/ChipSelectWithCustom";
import { GeneratedSamplesPanel } from "./components/brand-voice/GeneratedSamplesPanel";
import { SimulationLab } from "./components/brand-voice/SimulationLab";
import { ToneSelector } from "./components/brand-voice/ToneSelector";
import { ToneSliders } from "./components/brand-voice/ToneSliders";
import { TraitPickerModal } from "./components/trait-picker/TraitPickerModal";
import {
  BoardTrait,
  ProgramBoardState,
  createEmptyProgramBoardState,
  isBoardDirty,
  moveTraitInBoard,
  removeTraitFromBoard,
  toBoardIdState
} from "./program-board-state";
import "./styles.css";

const queryClient = new QueryClient();
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000";

type Trait = {
  id: string;
  name: string;
  category: TraitCategory;
  definition: string | null;
  rubricScaleMin: number;
  rubricScaleMax: number;
  rubricPositiveSignals: string | null;
  rubricNegativeSignals: string | null;
  rubricFollowUps: string | null;
  createdAt: string;
  updatedAt: string;
};

type TraitQuestion = {
  id: string;
  traitId: string;
  type: "chat" | "quiz";
  prompt: string;
  options: string[];
  createdAt: string;
  updatedAt: string;
};

type TraitFormState = {
  name: string;
  category: TraitCategory;
  definition: string;
  rubricPositiveSignals: string;
  rubricNegativeSignals: string;
  rubricFollowUps: string;
};

type Program = {
  id: string;
  name: string;
  description: string | null;
  degreeLevel: string | null;
  department: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProgramTrait = {
  id: string;
  traitId: string;
  bucket: ProgramTraitPriorityBucket;
  sortOrder: number;
  notes: string | null;
  trait: Trait;
};

type BrandVoice = {
  id: string;
  name: string;
  primaryTone: string;
  ttsVoiceName: string;
  toneModifiers: string[];
  toneProfile: ToneProfile;
  styleFlags: string[];
  avoidFlags: string[];
  canonicalExamples: CanonicalExample[];
};

const navLinkClass = "rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-200";
const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600";
const subtleButtonClass = "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50";
const openAiVoiceOptions = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  return data as T;
}

function splitListText(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinListText(items: string[]): string {
  return items.join("\n");
}

function buildDefinitionDraft(name: string, category: TraitCategory): string {
  const targetName = name.trim() || "This trait";
  return `${targetName} evaluates a candidate's ${category.toLowerCase().replaceAll("_", " ")} capability through consistent behaviors that indicate preparedness, growth potential, and fit for the program context.`;
}

function buildSignalSuggestions(kind: "positive" | "negative", name: string): string[] {
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

function buildQuestionPromptDraft(trait: Trait, type: "chat" | "quiz"): string {
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

function qualityHint(value: string): { label: string; className: string } {
  const count = value.trim().length;
  if (count >= 220) {
    return { label: "High quality detail", className: "text-emerald-700" };
  }
  if (count >= 100) {
    return { label: "Good depth", className: "text-slate-600" };
  }
  return { label: "Add more detail", className: "text-amber-700" };
}

const emptyTraitForm: TraitFormState = {
  name: "",
  category: "ACADEMIC",
  definition: "",
  rubricPositiveSignals: "",
  rubricNegativeSignals: "",
  rubricFollowUps: ""
};

function toTraitFormState(trait: Trait): TraitFormState {
  return {
    name: trait.name,
    category: trait.category,
    definition: trait.definition ?? "",
    rubricPositiveSignals: trait.rubricPositiveSignals ?? "",
    rubricNegativeSignals: trait.rubricNegativeSignals ?? "",
    rubricFollowUps: trait.rubricFollowUps ?? ""
  };
}

function FieldMeta({ value }: { value: string }) {
  const hint = qualityHint(value);
  return (
    <div className="mt-1 flex items-center justify-between text-xs">
      <span className="text-slate-500">{value.length} characters</span>
      <span className={hint.className}>{hint.label}</span>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-md border border-slate-200 bg-slate-50/50">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-800">{title}</summary>
      <div className="space-y-3 border-t border-slate-200 bg-white p-3">{children}</div>
    </details>
  );
}

function ListBuilder({
  label,
  items,
  placeholder,
  onChange,
  emptyText,
  suggestionButtonLabel,
  onSuggestion
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
  emptyText: string;
  suggestionButtonLabel?: string;
  onSuggestion?: () => void;
}) {
  const [draft, setDraft] = useState("");

  const addItem = () => {
    const next = draft.trim();
    if (!next) {
      return;
    }
    onChange([...items, next]);
    setDraft("");
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={labelClass}>{label}</label>
        {suggestionButtonLabel && onSuggestion && (
          <button type="button" className={subtleButtonClass} onClick={onSuggestion}>
            {suggestionButtonLabel}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-slate-500">{emptyText}</p>}
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="flex items-start gap-2">
            <input
              className={inputClass}
              value={item}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="mt-2 text-xs text-red-700 underline"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            className={inputClass}
            placeholder={placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
          />
          <Button type="button" onClick={addItem}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <h1 className="text-xl font-semibold">Program Match Admin</h1>
          <nav className="flex gap-2">
            <Link className={navLinkClass} to="/traits">
              Traits
            </Link>
            <Link className={navLinkClass} to="/programs">
              Programs
            </Link>
            <Link className={navLinkClass} to="/brand-voice">
              Brand Voice
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </AppShell>
  );
}

function TraitsPage() {
  const [traits, setTraits] = useState<Trait[]>([]);
  const [questions, setQuestions] = useState<TraitQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TraitCategory | "ALL">("ALL");
  const [selectedTraitId, setSelectedTraitId] = useState<string | null>(null);
  const [form, setForm] = useState<TraitFormState>({ ...emptyTraitForm });
  const [baselineForm, setBaselineForm] = useState<TraitFormState>({ ...emptyTraitForm });
  const [questionForm, setQuestionForm] = useState({
    id: "",
    prompt: "",
    type: "chat" as "chat" | "quiz",
    optionsText: ""
  });
  const [traitNotice, setTraitNotice] = useState<string | null>(null);
  const [traitError, setTraitError] = useState<string | null>(null);
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

      const payload = await request<{ data: Trait[] }>(`/api/admin/traits?${query.toString()}`);
      setTraits(payload.data);
      if (payload.data.length === 0) {
        setSelectedTraitId(null);
      } else if (selectedTraitId && !payload.data.some((trait) => trait.id === selectedTraitId)) {
        setSelectedTraitId(payload.data[0]?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (traitId: string) => {
    const payload = await request<{ data: TraitQuestion[] }>(`/api/admin/traits/${traitId}/questions`);
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

  const startEditTrait = (trait: Trait) => {
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

  const submitTrait = async (event: React.FormEvent) => {
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
        const updated = await request<{ data: Trait }>(`/api/admin/traits/${selectedTraitId}`, {
          method: "PUT",
          body: JSON.stringify(body)
        });
        const nextForm = toTraitFormState(updated.data);
        setForm(nextForm);
        setBaselineForm(nextForm);
        setTraitNotice("Trait saved.");
      } else {
        const created = await request<{ data: Trait }>("/api/admin/traits", {
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
    } catch (error) {
      setTraitError(error instanceof Error ? error.message : "Failed to save trait.");
    }
  };

  const deleteTrait = async (id: string) => {
    await request<{ ok: boolean }>(`/api/admin/traits/${id}`, { method: "DELETE" });
    if (selectedTraitId === id) {
      setSelectedTraitId(null);
      setForm({ ...emptyTraitForm });
      setBaselineForm({ ...emptyTraitForm });
    }
    await loadTraits();
  };

  const submitQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTraitId) {
      return;
    }

    const body = {
      prompt: questionForm.prompt,
      type: questionForm.type,
      options:
        questionForm.type === "quiz"
          ? questionForm.optionsText
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : undefined
    };

    if (questionForm.id) {
      await request<{ data: TraitQuestion }>(`/api/admin/questions/${questionForm.id}`, {
        method: "PUT",
        body: JSON.stringify(body)
      });
    } else {
      await request<{ data: TraitQuestion }>(`/api/admin/traits/${selectedTraitId}/questions`, {
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

  const deleteQuestion = async (id: string) => {
    await request<{ ok: boolean }>(`/api/admin/questions/${id}`, { method: "DELETE" });
    if (selectedTraitId) {
      await loadQuestions(selectedTraitId);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr_1fr]">
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Traits Library</h2>
        <div className="space-y-2">
          <button type="button" className={`${subtleButtonClass} w-full`} onClick={startCreateTrait}>
            + New Trait
          </button>
          <input className={inputClass} placeholder="Search traits..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select
            className={inputClass}
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as TraitCategory | "ALL")}
          >
            <option value="ALL">All categories</option>
            {traitCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 space-y-2">
          {loading && <p className="text-sm text-slate-500">Loading...</p>}
          {!loading && traits.length === 0 && <p className="text-sm text-slate-500">No traits yet. Create your first trait.</p>}
          {traits.map((trait) => (
            <button
              key={trait.id}
              type="button"
              onClick={() => startEditTrait(trait)}
              className={`w-full rounded-md border p-2 text-left text-sm ${
                selectedTraitId === trait.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"
              }`}
            >
              <div className="font-semibold">{trait.name}</div>
              <div className="text-xs text-slate-500">{trait.category}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{isEditing ? `Edit Trait: ${selectedTrait?.name ?? ""}` : "Create New Trait"}</h2>
            <p className="text-xs text-slate-500">{isEditing ? "Editing existing trait" : "Creating a new trait"}</p>
          </div>
          {selectedTrait && (
            <div className="flex gap-2">
              <button type="button" className="text-xs text-red-700 underline" onClick={() => void deleteTrait(selectedTrait.id)}>
                Delete trait
              </button>
            </div>
          )}
        </div>
        <form className="space-y-3" onSubmit={(event) => void submitTrait(event)}>
          <CollapsibleSection title="Basics">
            <div>
              <label className={labelClass}>Name</label>
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              <FieldMeta value={form.name} />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select
                className={inputClass}
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as TraitCategory }))}
              >
                {traitCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass}>Definition</label>
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      definition: buildDefinitionDraft(prev.name, prev.category)
                    }))
                  }
                >
                  AI Draft Definition
                </button>
              </div>
              <textarea
                className={inputClass}
                value={form.definition}
                onChange={(event) => setForm((prev) => ({ ...prev, definition: event.target.value }))}
              />
              <FieldMeta value={form.definition} />
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Rubric Signals">
            <ListBuilder
              label="Positive Signals"
              items={positiveSignals}
              placeholder="Add a positive signal"
              emptyText="No positive signals yet."
              suggestionButtonLabel="Generate 3 positive signals"
              onSuggestion={() =>
                setForm((prev) => ({
                  ...prev,
                  rubricPositiveSignals: joinListText(buildSignalSuggestions("positive", prev.name))
                }))
              }
              onChange={(items) => setForm((prev) => ({ ...prev, rubricPositiveSignals: joinListText(items) }))}
            />
            <ListBuilder
              label="Negative Signals"
              items={negativeSignals}
              placeholder="Add a negative signal"
              emptyText="No negative signals yet."
              suggestionButtonLabel="Generate 3 negative signals"
              onSuggestion={() =>
                setForm((prev) => ({
                  ...prev,
                  rubricNegativeSignals: joinListText(buildSignalSuggestions("negative", prev.name))
                }))
              }
              onChange={(items) => setForm((prev) => ({ ...prev, rubricNegativeSignals: joinListText(items) }))}
            />
          </CollapsibleSection>
          <div className="flex gap-2">
            <Button type="submit">{isEditing ? "Save Changes" : "Create Trait"}</Button>
            <button type="button" className="text-sm underline" onClick={resetTraitForm}>
              Reset
            </button>
          </div>
          {traitNotice && <p className="text-sm text-emerald-700">{traitNotice}</p>}
          {traitError && <p className="text-sm text-red-700">{traitError}</p>}
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Trait Questions</h2>
        {!selectedTrait ? (
          <p className="text-sm text-slate-500">Select a trait to manage questions after creating it.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">{selectedTrait.name}</p>
            <form className="space-y-3" onSubmit={(event) => void submitQuestion(event)}>
              <CollapsibleSection title="Question Details">
                <p className="mb-2 text-xs text-slate-500">
                  Questions elicit evidence. Scoring is based on the trait&apos;s rubric signals.
                </p>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className={labelClass}>Prompt</label>
                    <button
                      type="button"
                      className={subtleButtonClass}
                      onClick={() =>
                        setQuestionForm((prev) => ({
                          ...prev,
                          prompt: buildQuestionPromptDraft(selectedTrait, prev.type)
                        }))
                      }
                    >
                      AI Draft Prompt
                    </button>
                  </div>
                  <textarea
                    required
                    className={inputClass}
                    value={questionForm.prompt}
                    onChange={(event) => setQuestionForm((prev) => ({ ...prev, prompt: event.target.value }))}
                  />
                  <FieldMeta value={questionForm.prompt} />
                </div>
                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    className={inputClass}
                    value={questionForm.type}
                    onChange={(event) => setQuestionForm((prev) => ({ ...prev, type: event.target.value as "chat" | "quiz" }))}
                  >
                    <option value="chat">Chat</option>
                    <option value="quiz">Quiz</option>
                  </select>
                </div>
              </CollapsibleSection>
              {questionForm.type === "quiz" && (
                <CollapsibleSection title="Quiz Options" defaultOpen={false}>
                  <ListBuilder
                    label="Options"
                    items={quizOptions}
                    placeholder="Add a quiz option"
                    emptyText="No options yet."
                    onChange={(items) => setQuestionForm((prev) => ({ ...prev, optionsText: joinListText(items) }))}
                  />
                </CollapsibleSection>
              )}
              <div className="flex gap-2">
                <Button type="submit">{questionForm.id ? "Save Question" : "Add Question"}</Button>
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => setQuestionForm({ id: "", prompt: "", type: "chat", optionsText: "" })}
                >
                  Reset
                </button>
              </div>
            </form>
            <div className="mt-4 space-y-2">
              {questions.map((question) => (
                <div key={question.id} className="rounded-md border border-slate-200 p-2">
                  <div className="text-xs text-slate-500">{question.type.toUpperCase()}</div>
                  <div className="text-sm font-medium">{question.prompt}</div>
                  {question.options.length > 0 && <div className="text-xs text-slate-600">Options: {question.options.join(", ")}</div>}
                  <div className="mt-2 flex gap-2 text-xs">
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        setQuestionForm({
                          id: question.id,
                          prompt: question.prompt,
                          type: question.type,
                          optionsText: question.options.join("\n")
                        })
                      }
                    >
                      Edit
                    </button>
                    <button type="button" className="text-red-700 underline" onClick={() => void deleteQuestion(question.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [board, setBoard] = useState<ProgramBoardState>(createEmptyProgramBoardState);
  const [savedBoard, setSavedBoard] = useState<ProgramBoardState>(createEmptyProgramBoardState);
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [removingTrait, setRemovingTrait] = useState<BoardTrait | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<ProgramTraitPriorityBucket>>(
    () => new Set(["CRITICAL", "VERY_IMPORTANT", "IMPORTANT"])
  );
  const cancelRemoveButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmRemoveButtonRef = useRef<HTMLButtonElement | null>(null);

  const toggleBucketExpanded = (bucket: ProgramTraitPriorityBucket) => {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  };

  const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? null;
  const boardDirty = useMemo(() => isBoardDirty(board, savedBoard), [board, savedBoard]);

  const programDirty = useMemo(() => {
    if (!selectedProgram) return false;
    return (
      programForm.name !== selectedProgram.name ||
      programForm.description !== (selectedProgram.description ?? "") ||
      programForm.degreeLevel !== (selectedProgram.degreeLevel ?? "") ||
      programForm.department !== (selectedProgram.department ?? "")
    );
  }, [selectedProgram, programForm]);

  const pageDirty = programDirty || boardDirty;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadPrograms = async () => {
    const payload = await request<{ data: Program[] }>("/api/admin/programs");
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
    const payload = await request<{ data: Trait[] }>("/api/admin/traits");
    setTraits(payload.data);
  };

  const loadProgramTraits = async (programId: string) => {
    const payload = await request<{ data: ProgramTrait[] }>(`/api/admin/programs/${programId}/traits`);
    const nextState: ProgramBoardState = createEmptyProgramBoardState();

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

  const createProgram = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = await request<{ data: Program }>("/api/admin/programs", {
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

  const createProgramFromDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProgramDraft.name.trim() || !newProgramDraft.degreeLevel.trim() || !newProgramDraft.department.trim()) {
      setCreateError("Name, Degree Level, and Department are required.");
      return;
    }
    setCreateError(null);
    setIsCreatingSubmitting(true);
    try {
      const payload = await request<{ data: Program }>("/api/admin/programs", {
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
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create program.");
    } finally {
      setIsCreatingSubmitting(false);
    }
  };

  const deleteProgram = async (id: string) => {
    await request<{ ok: boolean }>(`/api/admin/programs/${id}`, { method: "DELETE" });
    await loadPrograms();
  };

  const moveTrait = (
    fromBucket: ProgramTraitPriorityBucket,
    fromIndex: number,
    toBucket: ProgramTraitPriorityBucket,
    toIndex?: number
  ) => {
    setBoard((current) => moveTraitInBoard(current, fromBucket, fromIndex, toBucket, toIndex));
  };

  const openRemoveDialog = (trait: BoardTrait) => {
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

  const onRemoveDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }
  };

  const saveBoard = async () => {
    if (!selectedProgramId) return;
    const boardIds = toBoardIdState(board);
    await request<{ data: unknown }>(`/api/admin/programs/${selectedProgramId}/traits`, {
      method: "PUT",
      body: JSON.stringify({
        items: boardStateToProgramTraitRows(boardIds)
      })
    });
    await loadProgramTraits(selectedProgramId);
  };

  const saveAllChanges = async () => {
    if (!pageDirty) return;
    setSaveError(null);
    setSaveStatus("saving");
    try {
      if (programDirty && selectedProgramId) {
        await request<{ data: Program }>(`/api/admin/programs/${selectedProgramId}`, {
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
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save changes.");
      setSaveStatus("error");
    }
  };

  const assignedTraitIds = useMemo(() => {
    const ids = new Set<string>();
    for (const bucket of Object.keys(board) as ProgramTraitPriorityBucket[]) {
      for (const trait of board[bucket]) {
        ids.add(trait.id);
      }
    }
    return ids;
  }, [board]);

  const addTraitsToBoard = (traitIds: string[], destinationBucket: ProgramTraitPriorityBucket) => {
    if (!selectedProgramId) return;

    const existingIds = new Set<string>();
    for (const bucket of Object.keys(board) as ProgramTraitPriorityBucket[]) {
      for (const trait of board[bucket]) {
        existingIds.add(trait.id);
      }
    }

    const nextTraits = traits.filter((trait) => traitIds.includes(trait.id) && !existingIds.has(trait.id));
    if (nextTraits.length === 0) {
      setTraitModalOpen(false);
      return;
    }

    const nextBoard: ProgramBoardState = {
      ...board,
      [destinationBucket]: [...board[destinationBucket], ...nextTraits]
    };
    setBoard(nextBoard);
    setTraitModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {pageDirty && (
            <span className="text-sm font-medium text-amber-700" role="status">
              Unsaved changes
            </span>
          )}
          {saveStatus === "saving" && (
            <span className="text-sm text-slate-500" role="status">
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-sm text-emerald-700" role="status">
              All changes saved
            </span>
          )}
          {saveStatus === "error" && saveError && (
            <span className="text-sm text-red-700" role="alert">
              {saveError}
            </span>
          )}
        </div>
        <Button
          type="button"
          onClick={() => void saveAllChanges()}
          disabled={!pageDirty || saveStatus === "saving"}
        >
          Save Changes
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_320px_1fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Programs</h2>
          <button
            type="button"
            onClick={startNewProgram}
            disabled={isCreatingNew}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            + New Program
          </button>
        </div>
        <div className="space-y-2">
          {isCreatingNew && (
            <form
              onSubmit={(e) => void createProgramFromDraft(e)}
              className="rounded-md border border-slate-200 bg-slate-50/80 p-3"
            >
              <div className="space-y-2">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    required
                    className={inputClass}
                    placeholder="Program name"
                    value={newProgramDraft.name}
                    onChange={(e) => setNewProgramDraft((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Degree Level</label>
                  <input
                    required
                    className={inputClass}
                    placeholder="e.g. Bachelor's"
                    value={newProgramDraft.degreeLevel}
                    onChange={(e) => setNewProgramDraft((prev) => ({ ...prev, degreeLevel: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Department</label>
                  <input
                    required
                    className={inputClass}
                    placeholder="e.g. Engineering"
                    value={newProgramDraft.department}
                    onChange={(e) => setNewProgramDraft((prev) => ({ ...prev, department: e.target.value }))}
                  />
                </div>
              </div>
              {createError && <p className="mt-2 text-sm text-red-700" role="alert">{createError}</p>}
              <div className="mt-3 flex gap-2">
                <Button type="submit" disabled={isCreatingSubmitting}>
                  {isCreatingSubmitting ? "Creating..." : "Create"}
                </Button>
                <button
                  type="button"
                  onClick={cancelNewProgram}
                  disabled={isCreatingSubmitting}
                  className={subtleButtonClass}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {programs.length === 0 && !isCreatingNew && (
            <p className="text-sm text-slate-500">No programs yet. Create one to begin.</p>
          )}
          {programs.map((program) => (
            <button
              key={program.id}
              type="button"
              onClick={() => setSelectedProgramId(program.id)}
              className={`w-full rounded-md border p-2 text-left text-sm ${
                selectedProgramId === program.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"
              }`}
            >
              <div className="font-semibold">{program.name}</div>
              {program.department && <div className="text-xs text-slate-500">{program.department}</div>}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{selectedProgram ? "Edit Program" : "Create Program"}</h2>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedProgram) return;
            void createProgram(event);
          }}
        >
          <div>
            <label className={labelClass}>Name</label>
            <input
              required
              className={inputClass}
              value={programForm.name}
              onChange={(event) => setProgramForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={inputClass}
              value={programForm.description}
              onChange={(event) => setProgramForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Degree Level</label>
            <input
              className={inputClass}
              value={programForm.degreeLevel}
              onChange={(event) => setProgramForm((prev) => ({ ...prev, degreeLevel: event.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <input
              className={inputClass}
              value={programForm.department}
              onChange={(event) => setProgramForm((prev) => ({ ...prev, department: event.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            {!selectedProgram && <Button type="submit">Create Program</Button>}
            {selectedProgram && (
              <button type="button" className="text-sm text-red-700 underline" onClick={() => void deleteProgram(selectedProgram.id)}>
                Delete
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trait Priority Board</h2>
          <button
            type="button"
            className={`${subtleButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => setTraitModalOpen(true)}
            disabled={!selectedProgram}
          >
            Add Trait
          </button>
        </div>

        {!selectedProgram ? (
          <p className="text-sm text-slate-500">Select a program to edit board priorities.</p>
        ) : (
          <div className="flex max-h-[32rem] flex-col gap-4 overflow-y-auto pr-1">
            {programTraitPriorityBuckets.map((bucket) => {
              const isExpanded = expandedBuckets.has(bucket);
              return (
                <div
                  key={bucket}
                  className="flex-shrink-0 rounded-lg border border-slate-200 bg-slate-50/80 shadow-sm"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const payload = event.dataTransfer.getData("text/plain");
                    if (!payload) {
                      return;
                    }
                    const parsed = JSON.parse(payload) as {
                      fromBucket: ProgramTraitPriorityBucket;
                      fromIndex: number;
                    };
                    if (!isExpanded) {
                      setExpandedBuckets((prev) => new Set(prev).add(bucket));
                    }
                    moveTrait(parsed.fromBucket, parsed.fromIndex, bucket);
                  }}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleBucketExpanded(bucket)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded text-left text-sm font-semibold text-slate-800 hover:bg-slate-100/80"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Collapse ${bucket}` : `Expand ${bucket}`}
                    >
                      <span className="flex-shrink-0 text-slate-500" aria-hidden>
                        {isExpanded ? "\u25BC" : "\u25B6"}
                      </span>
                      <span className="truncate">
                        {bucket} ({board[bucket].length})
                      </span>
                    </button>
                    {board[bucket].length === 0 && (
                      <span className="text-xs text-slate-500">Drag traits here</span>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="min-h-[4rem] space-y-2 p-3">
                      {board[bucket].length === 0 && (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-center text-xs text-slate-500">
                          Drag traits here
                        </p>
                      )}
                      {board[bucket].map((trait, index) => (
                    <div
                      key={trait.id}
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData(
                          "text/plain",
                          JSON.stringify({
                            fromBucket: bucket,
                            fromIndex: index
                          })
                        )
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const payload = event.dataTransfer.getData("text/plain");
                        if (!payload) {
                          return;
                        }
                        const parsed = JSON.parse(payload) as {
                          fromBucket: ProgramTraitPriorityBucket;
                          fromIndex: number;
                        };
                        moveTrait(parsed.fromBucket, parsed.fromIndex, bucket, index);
                      }}
                      className="group rounded-md border border-slate-300 bg-white p-2 text-sm transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <button
                            type="button"
                            className="mt-0.5 cursor-grab rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            title="Drag trait"
                            aria-label={`Drag ${trait.name}`}
                          >
                            ::
                          </button>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{trait.name}</div>
                            <div className="text-xs text-slate-500">{trait.category}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                          aria-label={`Remove ${trait.name} from board`}
                          onClick={() => openRemoveDialog(trait)}
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {removeDialogOpen && removingTrait && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-trait-title"
              aria-describedby="remove-trait-body"
              className="w-full max-w-md rounded-md bg-white p-4 shadow-lg"
              onKeyDown={onRemoveDialogKeyDown}
            >
              <h3 id="remove-trait-title" className="text-lg font-semibold">
                Remove trait from this program?
              </h3>
              <p id="remove-trait-body" className="mt-2 text-sm text-slate-600">
                This will remove the trait from the priority board for this program. It will not delete the trait from the library.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className={subtleButtonClass}
                  autoFocus
                  ref={cancelRemoveButtonRef}
                  onClick={cancelRemoveTrait}
                  aria-label="Cancel trait removal"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800"
                  ref={confirmRemoveButtonRef}
                  onClick={confirmRemoveTrait}
                  aria-label={`Remove ${removingTrait.name} from board`}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        <TraitPickerModal
          isOpen={traitModalOpen}
          onClose={() => setTraitModalOpen(false)}
          traits={traits}
          assignedTraitIds={assignedTraitIds}
          programId={selectedProgram?.id ?? null}
          degreeLevel={selectedProgram?.degreeLevel ?? null}
          department={selectedProgram?.department ?? null}
          onAddTraits={addTraitsToBoard}
        />
      </Card>
      </div>
    </div>
  );
}

export function BrandVoicePage() {
  type BrandVoiceFormState = {
    name: string;
    primaryTone: string;
    ttsVoiceName: string;
    toneModifiers: string[];
    toneProfile: ToneProfile;
    styleFlags: string[];
    avoidFlags: string[];
    canonicalExamples: CanonicalExample[];
  };

  const defaultBrandVoiceForm = (): BrandVoiceFormState => ({
    name: "",
    primaryTone: "professional",
    ttsVoiceName: "alloy",
    toneModifiers: ["encouraging"],
    toneProfile: { ...defaultToneProfile },
    styleFlags: [...defaultStyleFlags],
    avoidFlags: [...defaultAvoidFlags],
    canonicalExamples: []
  });

  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandVoiceFormState>(defaultBrandVoiceForm);
  const [seedText, setSeedText] = useState("");
  const [previewOverride, setPreviewOverride] = useState<Partial<Record<BrandVoiceSampleType, string>>>({});
  const [generatedSamples, setGeneratedSamples] = useState<{
    headline: string;
    cta: string;
    email_intro: string;
    description: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [voiceTestText, setVoiceTestText] = useState("Welcome to Graduate Admissions. Let me walk you through your next best step.");
  const [voiceTestUrl, setVoiceTestUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"configuration" | "simulation">("configuration");

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
    const payload = await request<{ data: BrandVoice[] }>("/api/admin/brand-voices");
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

  const createVoice = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const payload = await request<{ data: BrandVoice }>("/api/admin/brand-voices", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          canonicalExamples: form.canonicalExamples.filter((item) => item.pinned)
        })
      });
      await loadVoices();
      setSelectedVoiceId(payload.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand voice");
    }
  };

  const saveVoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVoiceId) {
      return;
    }
    setError(null);
    try {
      await request<{ data: BrandVoice }>(`/api/admin/brand-voices/${selectedVoiceId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          canonicalExamples: form.canonicalExamples.filter((item) => item.pinned)
        })
      });
      await loadVoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save brand voice");
    }
  };

  const deleteVoice = async (id: string) => {
    await request<{ ok: boolean }>(`/api/admin/brand-voices/${id}`, { method: "DELETE" });
    await loadVoices();
  };

  const generateSamples = async () => {
    if (!selectedVoiceId) {
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      const payload = await request<{
        samples: { headline: string; cta: string; email_intro: string; description: string };
      }>(`/api/admin/brand-voices/${selectedVoiceId}/generate-samples`, {
        method: "POST",
        body: JSON.stringify({ context: { useCase: "general" } })
      });
      setGeneratedSamples(payload.samples);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate sample language");
    } finally {
      setIsGenerating(false);
    }
  };

  const testVoice = async (voiceName?: string) => {
    setError(null);
    setIsTestingVoice(true);
    try {
      const payload = await request<{ data: { audioUrl: string } }>("/api/admin/brand-voices/test-voice", {
        method: "POST",
        body: JSON.stringify({
          voiceName: voiceName ?? form.ttsVoiceName,
          text: voiceTestText
        })
      });
      setVoiceTestUrl(payload.data.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test voice");
    } finally {
      setIsTestingVoice(false);
    }
  };

  const pinExample = (type: BrandVoiceSampleType, text: string) => {
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

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Brand Voices</h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
            onClick={startNewVoice}
          >
            New
          </button>
        </div>
        <div className="space-y-2">
          {voices.map((voice) => (
            <button
              key={voice.id}
              type="button"
              onClick={() => setSelectedVoiceId(voice.id)}
              className={`w-full rounded-md border p-2 text-left text-sm ${
                selectedVoiceId === voice.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"
              }`}
            >
              <div className="font-semibold">{voice.name}</div>
              <div className="text-xs text-slate-500">{voice.primaryTone}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{selectedVoice ? "Edit Brand Voice" : "Create Brand Voice"}</h2>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              activeTab === "configuration" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
            }`}
            onClick={() => setActiveTab("configuration")}
          >
            Configuration
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              activeTab === "simulation" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
            }`}
            onClick={() => setActiveTab("simulation")}
          >
            Simulation Lab
          </button>
        </div>
        {activeTab === "configuration" ? (
          <form
            className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
            onSubmit={(event) => void (selectedVoice ? saveVoice(event) : createVoice(event))}
          >
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Name</label>
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <ToneSelector
              primaryTone={form.primaryTone}
              modifiers={form.toneModifiers}
              onPrimaryToneChange={(primaryTone) => setForm((prev) => ({ ...prev, primaryTone }))}
              onModifiersChange={(toneModifiers) => setForm((prev) => ({ ...prev, toneModifiers }))}
            />

            <ToneSliders value={form.toneProfile} onChange={(toneProfile) => setForm((prev) => ({ ...prev, toneProfile }))} />

            <div className="rounded-md border border-slate-200 p-3">
              <h3 className="mb-2 text-sm font-semibold">Voice (OpenAI TTS)</h3>
              <label className={labelClass}>Preferred voice</label>
              <div className="flex flex-wrap gap-2">
                {openAiVoiceOptions.map((voice) => (
                  <button
                    key={`preferred-voice-${voice}`}
                    type="button"
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                      form.ttsVoiceName === voice
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, ttsVoiceName: voice }));
                      setVoiceTestUrl(null);
                      void testVoice(voice);
                    }}
                    disabled={isTestingVoice || voiceTestText.trim().length === 0}
                  >
                    {isTestingVoice && form.ttsVoiceName === voice ? `Sampling ${voice}...` : voice}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">This voice is used for simulation voice samples unless overridden.</p>
              {voiceTestUrl && (
                <audio key={voiceTestUrl} className="mt-2 block w-full max-w-full" controls preload="metadata" src={voiceTestUrl} />
              )}
            </div>

            <ChipSelectWithCustom
              label="Voice Behaviors"
              options={[...brandVoiceStyleFlagOptions]}
              value={form.styleFlags}
              onChange={(styleFlags) => setForm((prev) => ({ ...prev, styleFlags }))}
              addPlaceholder="Add custom behavior"
            />

            <ChipSelectWithCustom
              label="Avoid"
              options={[...brandVoiceAvoidFlagOptions]}
              value={form.avoidFlags}
              onChange={(avoidFlags) => setForm((prev) => ({ ...prev, avoidFlags }))}
              addPlaceholder="Add custom avoid rule"
            />

            <CollapsibleSection title="Canonical Examples" defaultOpen={false}>
              <div className="space-y-2">
                {form.canonicalExamples.length === 0 && <p className="text-xs text-slate-500">No pinned examples yet.</p>}
                {form.canonicalExamples.map((example) => (
                  <div key={example.id} className="rounded border border-slate-200 p-2 text-sm">
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{example.type}</div>
                    <div>{example.text}</div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <div className="flex gap-2">
              <Button type="submit">{selectedVoice ? "Save Brand Voice" : "Create Brand Voice"}</Button>
              {selectedVoice && (
                <button type="button" className="text-sm text-red-700 underline" onClick={() => void deleteVoice(selectedVoice.id)}>
                  Delete
                </button>
              )}
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelClass}>Use my own seed text</label>
              <input className={inputClass} value={seedText} onChange={(event) => setSeedText(event.target.value)} />
            </div>

            <BrandVoicePreview title="Live Preview" samples={preview} />

            <div className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Test Voice</h3>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => void testVoice()}
                  disabled={isTestingVoice || voiceTestText.trim().length === 0}
                >
                  {isTestingVoice ? "Testing..." : "Test voice"}
                </button>
              </div>
              <label className={labelClass}>Sample script</label>
              <textarea
                className={inputClass}
                rows={3}
                value={voiceTestText}
                onChange={(event) => setVoiceTestText(event.target.value)}
                placeholder="Enter short script to synthesize voice"
              />
              {voiceTestUrl && (
                <div className="mt-2 min-w-0 rounded border border-slate-200 p-2">
                  <a className="block break-all text-xs text-blue-700 underline" href={voiceTestUrl} target="_blank" rel="noreferrer">
                    Open tested audio
                  </a>
                  <audio className="mt-2 block w-full max-w-full" controls preload="metadata" src={voiceTestUrl} />
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Generate Sample Language</h3>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => void generateSamples()}
                  disabled={!selectedVoiceId || isGenerating}
                >
                  {isGenerating ? "Generating..." : "Generate Sample Language"}
                </button>
              </div>
              {!selectedVoiceId && (
                <p className="text-xs text-slate-500">Create this brand voice first, then generate AI suggestions.</p>
              )}
            </div>

            {generatedSamples && (
              <GeneratedSamplesPanel
                samples={generatedSamples}
                onPin={pinExample}
                onReplacePreview={(type, text) =>
                  setPreviewOverride((prev) => ({
                    ...prev,
                    [type]: text
                  }))
                }
              />
            )}
          </div>
          </form>
        ) : (
          <SimulationLab brandVoiceId={selectedVoiceId} request={request} />
        )}
      </Card>
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ShellLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/traits" replace />} />
              <Route path="/traits" element={<TraitsPage />} />
              <Route path="/programs" element={<ProgramsPage />} />
              <Route path="/brand-voice" element={<BrandVoicePage />} />
              <Route path="*" element={<Navigate to="/traits" replace />} />
            </Routes>
          </ShellLayout>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

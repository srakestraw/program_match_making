import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ProgramTraitPriorityBucket,
  TonePreset,
  TraitCategory,
  boardStateToProgramTraitRows,
  programTraitPriorityBuckets,
  tonePresets,
  traitCategories
} from "@pmm/domain";
import { AppShell, Button, Card } from "@pmm/ui";
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
  scoringHints: string | null;
  createdAt: string;
  updatedAt: string;
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
  tonePreset: TonePreset;
  doList: string | null;
  dontList: string | null;
  samplePhrases: string | null;
};

type ProgramBoardState = Record<ProgramTraitPriorityBucket, Trait[]>;

const emptyProgramBoardState: ProgramBoardState = {
  CRITICAL: [],
  VERY_IMPORTANT: [],
  IMPORTANT: [],
  NICE_TO_HAVE: []
};

const navLinkClass = "rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-200";
const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600";
const subtleButtonClass = "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50";

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
      "Shows reflection on outcomes and specific lessons learned.",
      "Connects prior experience to future program contribution.",
      "Communicates confidently while remaining precise and honest."
    ];
  }
  return [
    `Struggles to provide specific evidence of ${baseName.toLowerCase()}.`,
    "Uses vague or contradictory responses without clear reasoning.",
    "Deflects responsibility and avoids discussing improvement areas.",
    "Cannot connect past work to expected program demands.",
    "Shows low awareness of impact, collaboration, or accountability."
  ];
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
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "ACADEMIC" as TraitCategory,
    definition: "",
    rubricPositiveSignals: "",
    rubricNegativeSignals: "",
    rubricFollowUps: ""
  });
  const [questionForm, setQuestionForm] = useState({
    id: "",
    prompt: "",
    type: "chat" as "chat" | "quiz",
    optionsText: "",
    scoringHints: ""
  });
  const [traitNotice, setTraitNotice] = useState<string | null>(null);
  const [traitError, setTraitError] = useState<string | null>(null);
  const positiveSignals = useMemo(() => splitListText(form.rubricPositiveSignals), [form.rubricPositiveSignals]);
  const negativeSignals = useMemo(() => splitListText(form.rubricNegativeSignals), [form.rubricNegativeSignals]);
  const followUps = useMemo(() => splitListText(form.rubricFollowUps), [form.rubricFollowUps]);
  const quizOptions = useMemo(() => splitListText(questionForm.optionsText), [questionForm.optionsText]);

  const selectedTrait = traits.find((trait) => trait.id === selectedTraitId) ?? null;

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
      } else if (!payload.data.some((trait) => trait.id === selectedTraitId)) {
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

  useEffect(() => {
    if (!selectedTrait || !isEditing) {
      return;
    }
    setForm({
      name: selectedTrait.name,
      category: selectedTrait.category,
      definition: selectedTrait.definition ?? "",
      rubricPositiveSignals: selectedTrait.rubricPositiveSignals ?? "",
      rubricNegativeSignals: selectedTrait.rubricNegativeSignals ?? "",
      rubricFollowUps: selectedTrait.rubricFollowUps ?? ""
    });
  }, [selectedTrait, isEditing]);

  const resetTraitForm = () => {
    setIsEditing(false);
    setForm({
      name: "",
      category: "ACADEMIC",
      definition: "",
      rubricPositiveSignals: "",
      rubricNegativeSignals: "",
      rubricFollowUps: ""
    });
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

      if (isEditing && selectedTraitId) {
        await request<{ data: Trait }>(`/api/admin/traits/${selectedTraitId}`, {
          method: "PUT",
          body: JSON.stringify(body)
        });
        setTraitNotice("Trait saved.");
      } else {
        const created = await request<{ data: Trait }>("/api/admin/traits", {
          method: "POST",
          body: JSON.stringify(body)
        });
        setSelectedTraitId(created.data.id);
        setTraitNotice("Trait created.");
      }

      resetTraitForm();
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
          : undefined,
      scoringHints: questionForm.scoringHints
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
      optionsText: "",
      scoringHints: ""
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
              onClick={() => setSelectedTraitId(trait.id)}
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
          <h2 className="text-lg font-semibold">{isEditing ? "Edit Trait" : "Create Trait"}</h2>
          {selectedTrait && (
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-slate-600 underline"
                onClick={() => {
                  setIsEditing(true);
                }}
              >
                Load selected
              </button>
              <button type="button" className="text-xs text-red-700 underline" onClick={() => void deleteTrait(selectedTrait.id)}>
                Delete selected
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
              suggestionButtonLabel="Generate 5 positive signals"
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
              suggestionButtonLabel="Generate 5 negative signals"
              onSuggestion={() =>
                setForm((prev) => ({
                  ...prev,
                  rubricNegativeSignals: joinListText(buildSignalSuggestions("negative", prev.name))
                }))
              }
              onChange={(items) => setForm((prev) => ({ ...prev, rubricNegativeSignals: joinListText(items) }))}
            />
          </CollapsibleSection>
          <CollapsibleSection title="Follow-Ups" defaultOpen={false}>
            <ListBuilder
              label="Follow-up Questions"
              items={followUps}
              placeholder="Add a follow-up question"
              emptyText="No follow-ups yet."
              onChange={(items) => setForm((prev) => ({ ...prev, rubricFollowUps: joinListText(items) }))}
            />
          </CollapsibleSection>
          <div className="flex gap-2">
            <Button type="submit">{isEditing ? "Save Trait" : "Create Trait"}</Button>
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
          <p className="text-sm text-slate-500">Select a trait to manage questions.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">{selectedTrait.name}</p>
            <form className="space-y-3" onSubmit={(event) => void submitQuestion(event)}>
              <CollapsibleSection title="Question Details">
                <div>
                  <label className={labelClass}>Prompt</label>
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
              <CollapsibleSection title="Scoring Guidance" defaultOpen={false}>
                <div>
                  <label className={labelClass}>Scoring Hints</label>
                  <textarea
                    className={inputClass}
                    value={questionForm.scoringHints}
                    onChange={(event) => setQuestionForm((prev) => ({ ...prev, scoringHints: event.target.value }))}
                  />
                  <FieldMeta value={questionForm.scoringHints} />
                </div>
              </CollapsibleSection>
              <div className="flex gap-2">
                <Button type="submit">{questionForm.id ? "Save Question" : "Add Question"}</Button>
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => setQuestionForm({ id: "", prompt: "", type: "chat", optionsText: "", scoringHints: "" })}
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
                          optionsText: question.options.join("\n"),
                          scoringHints: question.scoringHints ?? ""
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

function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [board, setBoard] = useState<ProgramBoardState>(emptyProgramBoardState);
  const [programForm, setProgramForm] = useState({
    name: "",
    description: "",
    degreeLevel: "",
    department: ""
  });
  const [traitModalOpen, setTraitModalOpen] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState("");
  const [selectorCategory, setSelectorCategory] = useState<TraitCategory | "ALL">("ALL");
  const [selectedTraitIds, setSelectedTraitIds] = useState<Set<string>>(new Set());
  const [programNotice, setProgramNotice] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);

  const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? null;

  const loadPrograms = async () => {
    const payload = await request<{ data: Program[] }>("/api/admin/programs");
    setPrograms(payload.data);
    if (payload.data.length > 0 && !payload.data.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(payload.data[0]?.id ?? null);
    }
    if (payload.data.length === 0) {
      setSelectedProgramId(null);
      setBoard(emptyProgramBoardState);
    }
  };

  const loadTraits = async () => {
    const payload = await request<{ data: Trait[] }>("/api/admin/traits");
    setTraits(payload.data);
  };

  const loadProgramTraits = async (programId: string) => {
    const payload = await request<{ data: ProgramTrait[] }>(`/api/admin/programs/${programId}/traits`);
    const nextState: ProgramBoardState = {
      CRITICAL: [],
      VERY_IMPORTANT: [],
      IMPORTANT: [],
      NICE_TO_HAVE: []
    };

    for (const item of payload.data) {
      nextState[item.bucket].push(item.trait);
    }

    setBoard(nextState);
  };

  useEffect(() => {
    void Promise.all([loadPrograms(), loadTraits()]);
  }, []);

  useEffect(() => {
    if (!selectedProgramId) {
      setBoard(emptyProgramBoardState);
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

  const saveProgram = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProgramId) {
      return;
    }
    await request<{ data: Program }>(`/api/admin/programs/${selectedProgramId}`, {
      method: "PUT",
      body: JSON.stringify(programForm)
    });
    await loadPrograms();
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
    setBoard((current) => {
      const source = [...current[fromBucket]];
      const [moved] = source.splice(fromIndex, 1);
      if (!moved) {
        return current;
      }

      const destination = fromBucket === toBucket ? source : [...current[toBucket]];
      const insertIndex = toIndex === undefined ? destination.length : toIndex;
      destination.splice(insertIndex, 0, moved);

      return {
        ...current,
        [fromBucket]: source,
        [toBucket]: destination
      };
    });
  };

  const saveBoard = async () => {
    if (!selectedProgramId) {
      return;
    }

    setProgramNotice(null);
    setProgramError(null);

    try {
      const boardIds = {
        CRITICAL: board.CRITICAL.map((trait) => trait.id),
        VERY_IMPORTANT: board.VERY_IMPORTANT.map((trait) => trait.id),
        IMPORTANT: board.IMPORTANT.map((trait) => trait.id),
        NICE_TO_HAVE: board.NICE_TO_HAVE.map((trait) => trait.id)
      };

      await request<{ data: unknown }>(`/api/admin/programs/${selectedProgramId}/traits`, {
        method: "PUT",
        body: JSON.stringify({
          items: boardStateToProgramTraitRows(boardIds)
        })
      });
      await loadProgramTraits(selectedProgramId);
      setProgramNotice("Program board saved.");
    } catch (error) {
      setProgramError(error instanceof Error ? error.message : "Failed to save board.");
    }
  };

  const assignedTraitIds = useMemo(() => {
    const ids = new Set<string>();
    for (const bucket of programTraitPriorityBuckets) {
      for (const trait of board[bucket]) {
        ids.add(trait.id);
      }
    }
    return ids;
  }, [board]);

  const selectableTraits = useMemo(
    () =>
      traits.filter((trait) => {
        if (assignedTraitIds.has(trait.id)) {
          return false;
        }
        if (selectorCategory !== "ALL" && trait.category !== selectorCategory) {
          return false;
        }
        if (selectorSearch.trim()) {
          const q = selectorSearch.toLowerCase();
          return trait.name.toLowerCase().includes(q) || (trait.definition ?? "").toLowerCase().includes(q);
        }
        return true;
      }),
    [traits, assignedTraitIds, selectorCategory, selectorSearch]
  );

  const addSelectedTraits = () => {
    const nextTraits = traits.filter((trait) => selectedTraitIds.has(trait.id));
    if (nextTraits.length === 0) {
      return;
    }
    setBoard((current) => ({
      ...current,
      IMPORTANT: [...current.IMPORTANT, ...nextTraits]
    }));
    setSelectedTraitIds(new Set());
    setTraitModalOpen(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_320px_1fr]">
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Programs</h2>
        <div className="space-y-2">
          {programs.length === 0 && <p className="text-sm text-slate-500">No programs yet. Create one to begin.</p>}
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
        <form className="space-y-3" onSubmit={(event) => void (selectedProgram ? saveProgram(event) : createProgram(event))}>
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
            <Button type="submit">{selectedProgram ? "Save Program" : "Create Program"}</Button>
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
          <div className="flex gap-2">
            <Button type="button" onClick={() => setTraitModalOpen(true)} disabled={!selectedProgram}>
              Add Trait
            </Button>
            <Button type="button" onClick={() => void saveBoard()} disabled={!selectedProgram}>
              Save Board
            </Button>
          </div>
        </div>

        {!selectedProgram ? (
          <p className="text-sm text-slate-500">Select a program to edit board priorities.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {programTraitPriorityBuckets.map((bucket) => (
              <div
                key={bucket}
                className="rounded-md border border-slate-200 bg-slate-50 p-2"
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
                  moveTrait(parsed.fromBucket, parsed.fromIndex, bucket);
                }}
              >
                <h3 className="mb-2 text-sm font-semibold">{bucket}</h3>
                <div className="space-y-2">
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
                      className="cursor-grab rounded border border-slate-300 bg-white p-2 text-sm"
                    >
                      <div className="font-medium">{trait.name}</div>
                      <div className="text-xs text-slate-500">{trait.category}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {traitModalOpen && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-xl rounded-md bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Add Traits</h3>
                <button type="button" className="text-sm underline" onClick={() => setTraitModalOpen(false)}>
                  Close
                </button>
              </div>
              <div className="mb-3 grid gap-2 md:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="Search traits..."
                  value={selectorSearch}
                  onChange={(event) => setSelectorSearch(event.target.value)}
                />
                <select
                  className={inputClass}
                  value={selectorCategory}
                  onChange={(event) => setSelectorCategory(event.target.value as TraitCategory | "ALL")}
                >
                  <option value="ALL">All categories</option>
                  {traitCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-64 space-y-2 overflow-auto">
                {selectableTraits.map((trait) => (
                  <label key={trait.id} className="flex items-start gap-2 rounded border border-slate-200 p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTraitIds.has(trait.id)}
                      onChange={(event) =>
                        setSelectedTraitIds((prev) => {
                          const next = new Set(prev);
                          if (event.target.checked) {
                            next.add(trait.id);
                          } else {
                            next.delete(trait.id);
                          }
                          return next;
                        })
                      }
                    />
                    <span>
                      <span className="block font-medium">{trait.name}</span>
                      <span className="text-xs text-slate-500">{trait.category}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="button" onClick={addSelectedTraits}>
                  Add Selected
                </Button>
              </div>
            </div>
          </div>
        )}
        {programNotice && <p className="mt-3 text-sm text-emerald-700">{programNotice}</p>}
        {programError && <p className="mt-3 text-sm text-red-700">{programError}</p>}
      </Card>
    </div>
  );
}

function BrandVoicePage() {
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    tonePreset: "FRIENDLY" as TonePreset,
    doList: "",
    dontList: "",
    samplePhrases: ""
  });

  const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId) ?? null;

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
      setForm({
        name: "",
        tonePreset: "FRIENDLY",
        doList: "",
        dontList: "",
        samplePhrases: ""
      });
      return;
    }
    setForm({
      name: selectedVoice.name,
      tonePreset: selectedVoice.tonePreset,
      doList: selectedVoice.doList ?? "",
      dontList: selectedVoice.dontList ?? "",
      samplePhrases: selectedVoice.samplePhrases ?? ""
    });
  }, [selectedVoice]);

  const createVoice = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = await request<{ data: BrandVoice }>("/api/admin/brand-voices", {
      method: "POST",
      body: JSON.stringify(form)
    });
    await loadVoices();
    setSelectedVoiceId(payload.data.id);
  };

  const saveVoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVoiceId) {
      return;
    }
    await request<{ data: BrandVoice }>(`/api/admin/brand-voices/${selectedVoiceId}`, {
      method: "PUT",
      body: JSON.stringify(form)
    });
    await loadVoices();
  };

  const deleteVoice = async (id: string) => {
    await request<{ ok: boolean }>(`/api/admin/brand-voices/${id}`, { method: "DELETE" });
    await loadVoices();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Brand Voices</h2>
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
              <div className="text-xs text-slate-500">{voice.tonePreset}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{selectedVoice ? "Edit Brand Voice" : "Create Brand Voice"}</h2>
        <form className="space-y-3" onSubmit={(event) => void (selectedVoice ? saveVoice(event) : createVoice(event))}>
          <div>
            <label className={labelClass}>Name</label>
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Tone Preset</label>
            <select
              className={inputClass}
              value={form.tonePreset}
              onChange={(event) => setForm((prev) => ({ ...prev, tonePreset: event.target.value as TonePreset }))}
            >
              {tonePresets.map((tonePreset) => (
                <option key={tonePreset} value={tonePreset}>
                  {tonePreset}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Do List</label>
            <textarea
              className={inputClass}
              value={form.doList}
              onChange={(event) => setForm((prev) => ({ ...prev, doList: event.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Dont List</label>
            <textarea
              className={inputClass}
              value={form.dontList}
              onChange={(event) => setForm((prev) => ({ ...prev, dontList: event.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Sample Phrases</label>
            <textarea
              className={inputClass}
              value={form.samplePhrases}
              onChange={(event) => setForm((prev) => ({ ...prev, samplePhrases: event.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">{selectedVoice ? "Save Brand Voice" : "Create Brand Voice"}</Button>
            {selectedVoice && (
              <button type="button" className="text-sm text-red-700 underline" onClick={() => void deleteVoice(selectedVoice.id)}>
                Delete
              </button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
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

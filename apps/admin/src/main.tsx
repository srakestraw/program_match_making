import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrandVoiceSampleType,
  CanonicalExample,
  computeProgramStatus,
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
import { TraitProgramsAccordion, TraitProgramsPanel } from "./components/trait-detail/TraitProgramsPanel";
import { TraitPickerModal } from "./components/trait-picker/TraitPickerModal";
import { AdminWidgetEmbedPage } from "./components/widget/AdminWidgetEmbedPage";
import { WidgetBrandingPage } from "./components/widget/WidgetBrandingPage";
import { AdminWidgetPreviewPage } from "./components/widget/AdminWidgetPreviewPage";
import { AdminWidgetOrchestrationPage } from "./components/widget/AdminWidgetOrchestrationPage";
import { WidgetDropdown } from "./components/widget/WidgetDropdown";
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
  status: TraitStatus;
  definition: string | null;
  publicLabel?: string | null;
  oneLineHook?: string | null;
  archetypeTag?: ArchetypeTag | null;
  displayIcon?: string | null;
  visualMood?: TraitVisualMood | null;
  experienceDraftJson?: string | null;
  rubricScaleMin: number;
  rubricScaleMax: number;
  rubricPositiveSignals: string | null;
  rubricNegativeSignals: string | null;
  rubricFollowUps: string | null;
  completeness: TraitCompleteness;
  programSummary?: {
    count: number;
    topPrograms: Array<{
      programId: string;
      programName: string;
      bucket: ProgramTraitPriorityBucket;
      weight: number;
    }>;
  };
  createdAt: string;
  updatedAt: string;
};

type TraitStatus = "DRAFT" | "IN_REVIEW" | "ACTIVE" | "DEPRECATED";

type TraitCompleteness = {
  isComplete: boolean;
  percentComplete: number;
  missing: string[];
  counts: {
    positiveSignals: number;
    negativeSignals: number;
    questions: number;
  };
};

type TraitQuestion = {
  id: string;
  traitId: string;
  type: "chat" | "quiz";
  prompt: string;
  questionText?: string;
  narrativeIntro?: string | null;
  answerStyle?: "RADIO" | "CARD_GRID" | "SLIDER" | "CHAT" | null;
  answerOptionsMeta?: Array<{
    label: string;
    microCopy?: string;
    iconToken?: string;
    traitScore?: number;
  }>;
  options: string[];
  createdAt: string;
  updatedAt: string;
};

type ArchetypeTag = "ANALYST" | "BUILDER" | "STRATEGIST" | "OPERATOR" | "VISIONARY" | "LEADER" | "COMMUNICATOR";
type TraitVisualMood = "NEUTRAL" | "ASPIRATIONAL" | "PLAYFUL" | "BOLD" | "SERIOUS";

type TraitFormState = {
  name: string;
  category: TraitCategory;
  status: TraitStatus;
  definition: string;
  publicLabel: string;
  oneLineHook: string;
  archetypeTag: ArchetypeTag;
  displayIcon: string;
  visualMood: TraitVisualMood;
  experienceDraftJson: string;
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
  isActive: boolean;
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

type TraitProgramAssociation = {
  programId: string;
  programName: string;
  bucket: ProgramTraitPriorityBucket;
  weight: number;
  updatedAt: string;
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
const traitStatusOptions: TraitStatus[] = ["DRAFT", "IN_REVIEW", "ACTIVE", "DEPRECATED"];
const archetypeTagOptions: ArchetypeTag[] = ["ANALYST", "BUILDER", "STRATEGIST", "OPERATOR", "VISIONARY", "LEADER", "COMMUNICATOR"];
const visualMoodOptions: TraitVisualMood[] = ["NEUTRAL", "ASPIRATIONAL", "PLAYFUL", "BOLD", "SERIOUS"];
const canonicalQuizOptions = ["Beginner", "Developing", "Proficient", "Advanced"];
const traitStatusRank: Record<TraitStatus, number> = {
  ACTIVE: 0,
  IN_REVIEW: 1,
  DRAFT: 2,
  DEPRECATED: 3
};
const traitStatusTone: Record<TraitStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  DRAFT: "bg-slate-200 text-slate-700",
  DEPRECATED: "bg-rose-100 text-rose-700"
};
const traitListStatusMeta: Record<"ACTIVE" | "DRAFT" | "ARCHIVED", { label: string; dotClassName: string; textClassName: string }> = {
  ACTIVE: { label: "Active", dotClassName: "bg-emerald-500", textClassName: "text-emerald-700" },
  DRAFT: { label: "Draft", dotClassName: "bg-slate-400", textClassName: "text-slate-600" },
  ARCHIVED: { label: "Archived", dotClassName: "bg-rose-500", textClassName: "text-rose-700" }
};
const programListStatusMeta: Record<"DRAFT" | "ACTIVE" | "INACTIVE", { label: string; dotClassName: string; textClassName: string }> = {
  DRAFT: { label: "Draft", dotClassName: "bg-slate-400", textClassName: "text-slate-600" },
  ACTIVE: { label: "Active", dotClassName: "bg-emerald-500", textClassName: "text-emerald-700" },
  INACTIVE: { label: "Inactive", dotClassName: "bg-slate-400", textClassName: "text-slate-600" }
};

class ApiError extends Error {
  code?: string;
  missing?: string[];
  details?: unknown;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init
    });
  } catch {
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
        apiError.missing = (errorPayload.missing as unknown[]).filter((item): item is string => typeof item === "string");
      }
      if ("details" in errorPayload) {
        apiError.details = errorPayload.details;
      }
      throw apiError;
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

function toTraitFormState(trait: Trait): TraitFormState {
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

function normalizeTrait(trait: Partial<Trait> & { id: string; name: string; category: TraitCategory }): Trait {
  const status: TraitStatus = trait.status ?? "DRAFT";
  const completeness =
    trait.completeness ??
    computeDraftCompleteness(
      {
        name: trait.name,
        category: trait.category,
        status,
        definition: trait.definition ?? "",
        publicLabel: trait.publicLabel ?? "",
        oneLineHook: trait.oneLineHook ?? "",
        archetypeTag: (trait.archetypeTag as ArchetypeTag | undefined) ?? "ANALYST",
        displayIcon: trait.displayIcon ?? "",
        visualMood: (trait.visualMood as TraitVisualMood | undefined) ?? "ASPIRATIONAL",
        experienceDraftJson: trait.experienceDraftJson ?? "",
        rubricPositiveSignals: trait.rubricPositiveSignals ?? "",
        rubricNegativeSignals: trait.rubricNegativeSignals ?? "",
        rubricFollowUps: trait.rubricFollowUps ?? ""
      },
      0
    );
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
                bucket: item.bucket as ProgramTraitPriorityBucket,
                weight: Number(item.weight ?? 0)
              }))
            : []
        }
      : undefined,
    createdAt: trait.createdAt ?? new Date().toISOString(),
    updatedAt: trait.updatedAt ?? new Date().toISOString()
  };
}

function normalizeProgram(program: Partial<Program> & { id: string; name: string }): Program {
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

function normalizeTraitProgramAssociation(
  item: Partial<TraitProgramAssociation> & { programId: string }
): TraitProgramAssociation {
  const nowIso = new Date().toISOString();
  const parsedWeight = Number(item.weight ?? 0);
  const safeWeight = Number.isFinite(parsedWeight) ? Math.max(0, Math.min(1, parsedWeight)) : 0;
  const bucket = programTraitPriorityBuckets.includes(item.bucket as ProgramTraitPriorityBucket)
    ? (item.bucket as ProgramTraitPriorityBucket)
    : "IMPORTANT";
  return {
    programId: String(item.programId),
    programName: typeof item.programName === "string" && item.programName.trim().length > 0 ? item.programName : "Unknown program",
    bucket,
    weight: safeWeight,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : nowIso
  };
}

function computeDraftCompleteness(input: TraitFormState, questionsCount: number): TraitCompleteness {
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
  const missing: string[] = [];
  if (!checks[0]) missing.push("Name is required");
  if (!checks[1]) missing.push("Category is required");
  if (!checks[2]) missing.push("Definition is required");
  if (!checks[3]) missing.push("At least 3 positive signals are required");
  if (!checks[4]) missing.push("At least 2 negative signals are required");
  if (!checks[5]) missing.push("At least 1 question is required");

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

function mapTraitListStatus(status: TraitStatus): "ACTIVE" | "DRAFT" | "ARCHIVED" {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "DEPRECATED") return "ARCHIVED";
  return "DRAFT";
}

function mapProgramListStatus(program: Program): "DRAFT" | "ACTIVE" | "INACTIVE" {
  return computeProgramStatus(program);
}

function computeListCompletenessRatio(trait: Trait): number {
  const definitionComplete = (trait.definition ?? "").trim().length > 0;
  const rubricSignalCount = trait.completeness.counts.positiveSignals + trait.completeness.counts.negativeSignals;
  const rubricGeneratedCount = splitListText(trait.rubricFollowUps ?? "").length;
  const rubricComplete = rubricSignalCount > 0 || rubricGeneratedCount > 0;
  const hasQuestion = trait.completeness.counts.questions > 0;
  const passedChecks = [definitionComplete, rubricComplete, hasQuestion].filter(Boolean).length;
  return Math.round((passedChecks / 3) * 100);
}

function FieldMeta({ value }: { value: string }) {
  const hint = qualityHint(value);
  return (
    <div className="mt-1 flex items-center justify-end gap-2 text-xs text-slate-500">
      <span>{value.length} characters</span>
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
  addButtonLabel = "Add",
  suggestionButtonLabel,
  onSuggestion
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
  emptyText: string;
  addButtonLabel?: string;
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
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800">{label}</label>
        {suggestionButtonLabel && onSuggestion && (
          <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100" onClick={onSuggestion}>
            {suggestionButtonLabel}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-xs text-slate-500">{emptyText}</p>}
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-2 py-1">
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={item}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="text-xs text-red-600 hover:text-red-700"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <input
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
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
          <button type="button" className="text-sm font-medium text-slate-700 hover:text-slate-900" onClick={addItem}>
            {addButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TraitHeader({
  name,
  category,
  status,
  editorStatusLabel,
  isSaving,
  onSave,
  onDelete,
  showDelete
}: {
  name: string;
  category: TraitCategory;
  status: TraitStatus;
  editorStatusLabel: string | null;
  isSaving: boolean;
  onSave: () => void;
  onDelete: () => void;
  showDelete: boolean;
}) {
  return (
    <header className="sticky top-2 z-10 rounded-md border border-slate-200 bg-white/95 p-4 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-slate-900">{name.trim() || "New Trait"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>{category}</span>
            <span aria-hidden>·</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${traitStatusTone[status]}`}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              {status.replaceAll("_", " ")}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {editorStatusLabel && <p className="text-xs text-slate-500">{editorStatusLabel}</p>}
          <Button type="button" disabled={isSaving} onClick={onSave}>
            Save Changes
          </Button>
          {showDelete && (
            <button type="button" className="text-sm text-red-600 hover:text-red-700" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function TraitDefinitionSection({
  form,
  setForm,
  titleInputRef,
  actionableMissing,
  showActivationNotice,
  isEditing,
  experienceDraft,
  generatingExperienceDraft,
  onGenerateExperienceDraft,
  onApplyExperienceDraft,
  onDiscardExperienceDraft
}: {
  form: TraitFormState;
  setForm: React.Dispatch<React.SetStateAction<TraitFormState>>;
  titleInputRef: React.MutableRefObject<HTMLInputElement | null>;
  actionableMissing: string[];
  showActivationNotice: boolean;
  isEditing: boolean;
  experienceDraft: {
    publicLabel: string;
    oneLineHook: string;
    archetypeTag: ArchetypeTag;
    displayIcon: string;
    visualMood: TraitVisualMood;
  } | null;
  generatingExperienceDraft: boolean;
  onGenerateExperienceDraft: (action: "generate" | "gen_z" | "simplify" | "aspirational") => void;
  onApplyExperienceDraft: () => void;
  onDiscardExperienceDraft: () => void;
}) {
  return (
    <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold text-slate-900">Definition</h2>
      <div className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="trait-title-input">
            Name
          </label>
          <input
            id="trait-title-input"
            ref={titleInputRef}
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
          <label className={labelClass} htmlFor="trait-status-select">
            Status
          </label>
          <select
            id="trait-status-select"
            className={inputClass}
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as TraitStatus }))}
          >
            {traitStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={labelClass}>Definition</label>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
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
      </div>

      <details className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Student-Facing Label</summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-slate-600">Used in the quiz UI and results. Does not affect scoring.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={subtleButtonClass} disabled={!isEditing || generatingExperienceDraft} onClick={() => onGenerateExperienceDraft("generate")}>
              {generatingExperienceDraft ? "Generating..." : "Generate with AI"}
            </button>
            <button type="button" className={subtleButtonClass} disabled={!isEditing || generatingExperienceDraft} onClick={() => onGenerateExperienceDraft("gen_z")}>
              Rewrite for Gen Z
            </button>
            <button type="button" className={subtleButtonClass} disabled={!isEditing || generatingExperienceDraft} onClick={() => onGenerateExperienceDraft("simplify")}>
              Simplify
            </button>
            <button type="button" className={subtleButtonClass} disabled={!isEditing || generatingExperienceDraft} onClick={() => onGenerateExperienceDraft("aspirational")}>
              Make more aspirational
            </button>
          </div>

          {experienceDraft && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">AI Draft Ready</p>
              <p className="mt-1 text-xs text-slate-700">{experienceDraft.publicLabel || form.name} · {experienceDraft.archetypeTag} · {experienceDraft.visualMood}</p>
              <p className="mt-1 text-xs text-slate-700">{experienceDraft.oneLineHook}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={subtleButtonClass} onClick={onApplyExperienceDraft}>Apply</button>
                <button type="button" className={subtleButtonClass} onClick={onDiscardExperienceDraft}>Discard</button>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Display Name</label>
            <input className={inputClass} value={form.publicLabel} onChange={(event) => setForm((prev) => ({ ...prev, publicLabel: event.target.value }))} />
            <p className="mt-1 text-xs text-slate-500">
              Preview label: <span className="font-medium text-slate-700">{form.publicLabel.trim() || form.name.trim() || "Untitled trait"}</span>
            </p>
          </div>
          <div>
            <label className={labelClass}>Short Description</label>
            <textarea className={inputClass} value={form.oneLineHook} onChange={(event) => setForm((prev) => ({ ...prev, oneLineHook: event.target.value }))} />
          </div>

          <details className="rounded-md border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">Advanced</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>Archetype Tag</label>
                <select className={inputClass} value={form.archetypeTag} onChange={(event) => setForm((prev) => ({ ...prev, archetypeTag: event.target.value as ArchetypeTag }))}>
                  {archetypeTagOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Display Icon</label>
                <input className={inputClass} value={form.displayIcon} onChange={(event) => setForm((prev) => ({ ...prev, displayIcon: event.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Visual Mood</label>
                <select className={inputClass} value={form.visualMood} onChange={(event) => setForm((prev) => ({ ...prev, visualMood: event.target.value as TraitVisualMood }))}>
                  {visualMoodOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </details>
        </div>
      </details>

      {showActivationNotice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">This trait won&apos;t affect scoring until Active.</p>
          {actionableMissing.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {actionableMissing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TraitRubricEditor({
  isEditing,
  generatingRubric,
  onGenerateRubricWithAi,
  rubricDraft,
  onApplyRubricDraft,
  onDiscardRubricDraft,
  positiveSignals,
  negativeSignals,
  followUps,
  setForm
}: {
  isEditing: boolean;
  generatingRubric: boolean;
  onGenerateRubricWithAi: () => void;
  rubricDraft: { positiveSignals: string[]; negativeSignals: string[]; followUps: string[] } | null;
  onApplyRubricDraft: () => void;
  onDiscardRubricDraft: () => void;
  positiveSignals: string[];
  negativeSignals: string[];
  followUps: string[];
  setForm: React.Dispatch<React.SetStateAction<TraitFormState>>;
}) {
  return (
    <section className="space-y-4 border-b border-slate-200/80 pb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Scoring Signals</h3>
        {isEditing && (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            disabled={generatingRubric}
            onClick={onGenerateRubricWithAi}
          >
            {generatingRubric ? "Generating…" : "Generate with AI"}
          </button>
        )}
      </div>
      {!isEditing && <p className="text-xs text-slate-500">Save the trait first to use &quot;Generate with AI&quot;.</p>}
      {rubricDraft && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="font-semibold text-slate-900">Draft rubric ready</p>
          <p className="mt-1 text-xs text-slate-700">
            {rubricDraft.positiveSignals.length} positive · {rubricDraft.negativeSignals.length} negative · {rubricDraft.followUps.length} follow-ups
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={subtleButtonClass} onClick={onApplyRubricDraft}>Apply</button>
            <button type="button" className={subtleButtonClass} onClick={onDiscardRubricDraft}>Discard</button>
          </div>
        </div>
      )}
      <ListBuilder
        label="Positive Signals"
        items={positiveSignals}
        placeholder="Add a positive signal"
        emptyText="No positive signals yet."
        addButtonLabel="+ Add signal"
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
        addButtonLabel="+ Add signal"
        suggestionButtonLabel="Generate 3 negative signals"
        onSuggestion={() =>
          setForm((prev) => ({
            ...prev,
            rubricNegativeSignals: joinListText(buildSignalSuggestions("negative", prev.name))
          }))
        }
        onChange={(items) => setForm((prev) => ({ ...prev, rubricNegativeSignals: joinListText(items) }))}
      />
      <ListBuilder
        label="Rubric Follow-Ups"
        items={followUps}
        placeholder="Add an optional follow-up"
        emptyText="No follow-up prompts yet."
        addButtonLabel="+ Add follow-up"
        onChange={(items) => setForm((prev) => ({ ...prev, rubricFollowUps: joinListText(items.slice(0, 2)) }))}
      />
      {positiveSignals.length === 0 && negativeSignals.length === 0 && (
        <p className="text-xs text-slate-500">Add at least 3 positive and 2 negative signals to activate.</p>
      )}
    </section>
  );
}

function TraitQuestionsEditor({
  selectedTrait,
  generatingQuestionsDraft,
  onGenerateQuestionsDraftWithAi,
  onSaveQuizDesign,
  onSaveChatDesign,
  questions,
  rubricFollowUps
}: {
  selectedTrait: Trait | null;
  generatingQuestionsDraft: boolean;
  onGenerateQuestionsDraftWithAi: () => Promise<{
    quiz: {
      narrativeIntro: string;
      questionText: string;
      answerStyle: "RADIO" | "CARD_GRID" | "SLIDER";
      optionMeta: Array<{ label: string; microCopy: string; iconToken: string; traitScore: number }>;
    };
    chat: { chatQuestion1: string; chatQuestion2: string; rubricFollowUps: string };
  }>;
  onSaveQuizDesign: (input: {
    narrativeIntro: string;
    questionText: string;
    answerStyle: "RADIO" | "CARD_GRID" | "SLIDER";
    optionMeta: Array<{ label: string; microCopy: string; iconToken: string; traitScore: number }>;
  }) => Promise<void>;
  onSaveChatDesign: (input: { chatQuestion1: string; chatQuestion2: string; rubricFollowUps: string }) => Promise<void>;
  questions: TraitQuestion[];
  rubricFollowUps: string;
}) {
  const [tab, setTab] = useState<"quiz" | "chat">("quiz");
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [savingChat, setSavingChat] = useState(false);
  const [quizDraft, setQuizDraft] = useState<{
    narrativeIntro: string;
    questionText: string;
    answerStyle: "RADIO" | "CARD_GRID" | "SLIDER";
    optionMeta: Array<{ label: string; microCopy: string; iconToken: string; traitScore: number }>;
  } | null>(null);
  const [chatDraft, setChatDraft] = useState<{ chatQuestion1: string; chatQuestion2: string; rubricFollowUps: string } | null>(null);

  const savedQuizQuestion = useMemo(() => questions.find((question) => question.type === "quiz") ?? null, [questions]);
  const savedChatQuestions = useMemo(() => questions.filter((question) => question.type === "chat").slice(0, 2), [questions]);
  const [quizForm, setQuizForm] = useState({
    narrativeIntro: "",
    questionText: "",
    answerStyle: "CARD_GRID" as "RADIO" | "CARD_GRID" | "SLIDER",
    optionMeta: canonicalQuizOptions.map((label, index) => ({
      label,
      microCopy: "",
      iconToken: "",
      traitScore: index + 1
    }))
  });
  const [chatForm, setChatForm] = useState({ chatQuestion1: "", chatQuestion2: "", rubricFollowUps: "" });

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
      answerStyle:
        savedQuizQuestion?.answerStyle === "RADIO" || savedQuizQuestion?.answerStyle === "SLIDER" ? savedQuizQuestion.answerStyle : "CARD_GRID",
      optionMeta: optionMetaFromQuestion
    });
    setChatForm({
      chatQuestion1: savedChatQuestions[0]?.prompt ?? "",
      chatQuestion2: savedChatQuestions[1]?.prompt ?? "",
      rubricFollowUps
    });
  }, [savedQuizQuestion, savedChatQuestions, rubricFollowUps]);

  if (!selectedTrait) {
    return <p className="text-sm text-slate-500">Select a trait to manage interview questions.</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Interaction Design</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium ${tab === "quiz" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            onClick={() => setTab("quiz")}
          >
            Quiz
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium ${tab === "chat" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500">Questions elicit evidence. Scoring uses rubric signals.</p>

      {tab === "quiz" && (
        <div className="space-y-4 rounded-md border border-slate-200/80 p-3">
          <div className="text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Current (saved)</p>
            <p>{savedQuizQuestion?.prompt || "No quiz question saved yet."}</p>
          </div>
          <div>
            <label className={labelClass}>Narrative Intro (optional)</label>
            <textarea className={inputClass} value={quizForm.narrativeIntro} onChange={(event) => setQuizForm((prev) => ({ ...prev, narrativeIntro: event.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Question Text</label>
            <textarea className={inputClass} value={quizForm.questionText} onChange={(event) => setQuizForm((prev) => ({ ...prev, questionText: event.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Answer Style</label>
            <select className={inputClass} value={quizForm.answerStyle} onChange={(event) => setQuizForm((prev) => ({ ...prev, answerStyle: event.target.value as "RADIO" | "CARD_GRID" | "SLIDER" }))}>
              <option value="CARD_GRID">CARD_GRID</option>
              <option value="RADIO">RADIO</option>
              <option value="SLIDER">SLIDER</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Option Microcopy (display-only)</p>
            {quizForm.optionMeta.map((meta, index) => (
              <div key={`quiz-meta-${meta.label}-${index}`} className="grid gap-2 md:grid-cols-4">
                <input className={inputClass} value={meta.label} readOnly />
                <input
                  className={inputClass}
                  placeholder="Microcopy"
                  value={meta.microCopy}
                  onChange={(event) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      optionMeta: prev.optionMeta.map((item, itemIndex) => (itemIndex === index ? { ...item, microCopy: event.target.value } : item))
                    }))
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Icon token"
                  value={meta.iconToken}
                  onChange={(event) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      optionMeta: prev.optionMeta.map((item, itemIndex) => (itemIndex === index ? { ...item, iconToken: event.target.value } : item))
                    }))
                  }
                />
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={5}
                  value={meta.traitScore}
                  onChange={(event) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      optionMeta: prev.optionMeta.map((item, itemIndex) => (itemIndex === index ? { ...item, traitScore: Number(event.target.value || 0) } : item))
                    }))
                  }
                />
              </div>
            ))}
          </div>
          {quizDraft && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">Draft values ready</p>
              <p className="mt-1 text-xs text-slate-700">{quizDraft.questionText}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={() => {
                    void onSaveQuizDesign(quizDraft);
                    setQuizDraft(null);
                  }}
                >
                  Apply
                </button>
                <button type="button" className={subtleButtonClass} onClick={() => setQuizDraft(null)}>
                  Discard
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={subtleButtonClass}
              disabled={generatingQuestionsDraft}
              onClick={() =>
                void onGenerateQuestionsDraftWithAi().then((draft) => {
                  setQuizDraft(draft.quiz);
                })
              }
            >
              {generatingQuestionsDraft ? "Generating..." : "Generate"}
            </button>
            <Button
              type="button"
              disabled={savingQuiz}
              onClick={async () => {
                setSavingQuiz(true);
                try {
                  await onSaveQuizDesign(quizForm);
                } finally {
                  setSavingQuiz(false);
                }
              }}
            >
              {savingQuiz ? "Saving..." : "Save Quiz Design"}
            </Button>
          </div>
        </div>
      )}

      {tab === "chat" && (
        <div className="space-y-4 rounded-md border border-slate-200/80 p-3">
          <div className="text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Current (saved)</p>
            <p>{savedChatQuestions[0]?.prompt || "No chat questions saved yet."}</p>
            {savedChatQuestions[1]?.prompt && <p>{savedChatQuestions[1]?.prompt}</p>}
          </div>
          <div>
            <label className={labelClass}>Chat Question 1</label>
            <textarea className={inputClass} value={chatForm.chatQuestion1} onChange={(event) => setChatForm((prev) => ({ ...prev, chatQuestion1: event.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Chat Question 2</label>
            <textarea className={inputClass} value={chatForm.chatQuestion2} onChange={(event) => setChatForm((prev) => ({ ...prev, chatQuestion2: event.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Rubric Follow-Ups (0-2 lines)</label>
            <textarea className={inputClass} value={chatForm.rubricFollowUps} onChange={(event) => setChatForm((prev) => ({ ...prev, rubricFollowUps: event.target.value }))} />
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Chat scoring uses rubric signals (3 positive, 3 negative) to derive a 0-5 score.
          </div>
          {chatDraft && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">Draft values ready</p>
              <p className="mt-1 text-xs text-slate-700">{chatDraft.chatQuestion1}</p>
              <p className="mt-1 text-xs text-slate-700">{chatDraft.chatQuestion2}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={() => {
                    void onSaveChatDesign(chatDraft);
                    setChatDraft(null);
                  }}
                >
                  Apply
                </button>
                <button type="button" className={subtleButtonClass} onClick={() => setChatDraft(null)}>
                  Discard
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={subtleButtonClass}
              disabled={generatingQuestionsDraft}
              onClick={() =>
                void onGenerateQuestionsDraftWithAi().then((draft) => {
                  setChatDraft(draft.chat);
                })
              }
            >
              {generatingQuestionsDraft ? "Generating..." : "Generate"}
            </button>
            <Button
              type="button"
              disabled={savingChat}
              onClick={async () => {
                setSavingChat(true);
                try {
                  await onSaveChatDesign(chatForm);
                } finally {
                  setSavingChat(false);
                }
              }}
            >
              {savingChat ? "Saving..." : "Save Chat Design"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function TraitScoringInterviewSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-6 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold text-slate-900">Scoring &amp; Interview</h2>
      {children}
    </section>
  );
}

function TraitProgramsSidebar({
  selectedTrait,
  selectedTraitPrograms,
  selectedTraitProgramsLoading,
  selectedTraitProgramsError,
  onManage,
  onProgramClick
}: {
  selectedTrait: Trait | null;
  selectedTraitPrograms: TraitProgramAssociation[];
  selectedTraitProgramsLoading: boolean;
  selectedTraitProgramsError: string | null;
  onManage: () => void;
  onProgramClick: (programId: string) => void;
}) {
  if (!selectedTrait) {
    return null;
  }

  return (
    <aside
      className="hidden w-full min-w-[240px] max-w-[340px] self-start overflow-auto lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]"
      aria-label="Used in programs"
    >
      <TraitProgramsPanel
        programs={selectedTraitPrograms}
        loading={selectedTraitProgramsLoading}
        error={selectedTraitProgramsError}
        onManage={onManage}
        onProgramClick={onProgramClick}
      />
    </aside>
  );
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <h1 className="text-xl font-semibold">Program Match Admin</h1>
          <nav className="flex items-center gap-2">
            <Link className={navLinkClass} to="/traits">
              Traits
            </Link>
            <Link className={navLinkClass} to="/programs">
              Programs
            </Link>
            <Link className={navLinkClass} to="/brand-voice">
              Brand Voice
            </Link>
            <Link className={navLinkClass} to="/quiz-experience">
              Quiz Experience
            </Link>
            <Link className={navLinkClass} to="/widget/branding">
              Widget Branding
            </Link>
            <WidgetDropdown />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </AppShell>
  );
}

export function TraitsPage() {
  const navigate = useNavigate();
  const [traits, setTraits] = useState<Trait[]>([]);
  const [questions, setQuestions] = useState<TraitQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TraitCategory | "ALL">("ALL");
  const [selectedTraitId, setSelectedTraitId] = useState<string | null>(null);
  const [form, setForm] = useState<TraitFormState>({ ...emptyTraitForm });
  const [baselineForm, setBaselineForm] = useState<TraitFormState>({ ...emptyTraitForm });
  const [experienceDraft, setExperienceDraft] = useState<{
    publicLabel: string;
    oneLineHook: string;
    archetypeTag: ArchetypeTag;
    displayIcon: string;
    visualMood: TraitVisualMood;
  } | null>(null);
  const [generatingExperienceDraft, setGeneratingExperienceDraft] = useState(false);
  const [traitNotice, setTraitNotice] = useState<string | null>(null);
  const [traitError, setTraitError] = useState<string | null>(null);
  const [activationMissing, setActivationMissing] = useState<string[]>([]);
  const [rubricDraft, setRubricDraft] = useState<{ positiveSignals: string[]; negativeSignals: string[]; followUps: string[] } | null>(null);
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [generatingQuestionsDraft, setGeneratingQuestionsDraft] = useState(false);
  const [programDrawerTraitId, setProgramDrawerTraitId] = useState<string | null>(null);
  const [selectedTraitPrograms, setSelectedTraitPrograms] = useState<TraitProgramAssociation[]>([]);
  const [selectedTraitProgramsLoading, setSelectedTraitProgramsLoading] = useState(false);
  const [selectedTraitProgramsError, setSelectedTraitProgramsError] = useState<string | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [editorSaveStatus, setEditorSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const focusTitleOnSelectRef = useRef(false);
  const createDraftRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const positiveSignals = useMemo(() => splitListText(form.rubricPositiveSignals), [form.rubricPositiveSignals]);
  const negativeSignals = useMemo(() => splitListText(form.rubricNegativeSignals), [form.rubricNegativeSignals]);
  const followUps = useMemo(() => splitListText(form.rubricFollowUps), [form.rubricFollowUps]);
  const traitFormDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baselineForm), [form, baselineForm]);
  const draftCompleteness = useMemo(() => computeDraftCompleteness(form, questions.length), [form, questions.length]);
  const editorStatusLabel = useMemo(() => {
    if (isCreatingDraft || editorSaveStatus === "saving") {
      return "Saving...";
    }
    if (traitFormDirty) {
      return "Unsaved changes";
    }
    if (editorSaveStatus === "saved") {
      return "Saved";
    }
    return null;
  }, [editorSaveStatus, isCreatingDraft, traitFormDirty]);

  const selectedTrait = traits.find((trait) => trait.id === selectedTraitId) ?? null;
  const isEditing = Boolean(selectedTraitId && selectedTrait);
  const sortedTraits = useMemo(
    () =>
      [...traits].sort((a, b) => {
        const statusDiff = traitStatusRank[a.status] - traitStatusRank[b.status];
        if (statusDiff !== 0) return statusDiff;
        return a.name.localeCompare(b.name);
      }),
    [traits]
  );

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
      const payload = await request<{ data: Trait[] }>(`/api/admin/traits?${query.toString()}`);
      setTraits(payload.data.map((trait) => normalizeTrait(trait)));
      if (payload.data.length === 0) {
        setSelectedTraitId(null);
      } else if (selectedTraitId && !payload.data.some((trait) => trait.id === selectedTraitId)) {
        setSelectedTraitId(payload.data[0]?.id ?? null);
      }
    } catch (error) {
      setTraitError(error instanceof Error ? error.message : "Failed to load traits.");
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (traitId: string) => {
    const payload = await request<{ data: TraitQuestion[] }>(`/api/admin/traits/${traitId}/questions`);
    setQuestions(payload.data);
  };

  const loadTraitPrograms = async (traitId: string) => {
    setSelectedTraitProgramsLoading(true);
    setSelectedTraitProgramsError(null);
    try {
      const payload = await request<{ data: Array<Partial<TraitProgramAssociation> & { programId: string }> }>(
        `/api/admin/traits/${traitId}/programs`
      );
      setSelectedTraitPrograms(payload.data.map((item) => normalizeTraitProgramAssociation(item)));
    } catch (error) {
      setSelectedTraitPrograms([]);
      setSelectedTraitProgramsError(error instanceof Error ? error.message : "Failed to load associated programs.");
    } finally {
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
    if (!selectedTraitId || !focusTitleOnSelectRef.current) return;
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
    if (isCreatingDraft) return;
    if (!canLeaveTraitForm()) {
      return;
    }
    const requestId = createDraftRequestIdRef.current + 1;
    createDraftRequestIdRef.current = requestId;
    setIsCreatingDraft(true);
    setEditorSaveStatus("saving");
    setTraitNotice(null);
    setTraitError(null);
    try {
      const created = await request<{ data: Trait }>("/api/admin/traits", {
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
      setExperienceDraft(null);
      setRubricDraft(null);
      setActivationMissing([]);
      setTraitNotice("Saved");
      setEditorSaveStatus("saved");
      focusTitleOnSelectRef.current = true;
      await loadTraits();
      await loadQuestions(normalized.id);
    } catch (error) {
      if (!isMountedRef.current || createDraftRequestIdRef.current !== requestId) {
        return;
      }
      setTraitError(error instanceof Error ? error.message : "Could not create draft trait.");
      setEditorSaveStatus("error");
    } finally {
      if (isMountedRef.current && createDraftRequestIdRef.current === requestId) {
        setIsCreatingDraft(false);
      }
    }
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
    setExperienceDraft(null);
    setActivationMissing([]);
    setEditorSaveStatus("idle");
  };

  const submitTrait = async (event?: React.FormEvent) => {
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
        const updated = await request<{ data: Trait }>(`/api/admin/traits/${selectedTraitId}`, {
          method: "PUT",
          body: JSON.stringify(body)
        });
        const nextForm = toTraitFormState(updated.data);
        setForm(nextForm);
        setBaselineForm(nextForm);
        setTraitNotice("Saved");
      } else {
        const created = await request<{ data: Trait }>("/api/admin/traits", {
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
    } catch (error) {
      if (error instanceof ApiError && error.code === "TRAIT_INCOMPLETE") {
        setTraitError("Trait incomplete");
        setActivationMissing(error.missing ?? []);
        setForm((prev) => ({ ...prev, status: baselineForm.status }));
        setEditorSaveStatus("error");
      } else {
        setTraitError(error instanceof Error ? error.message : "Failed to save trait.");
        setEditorSaveStatus("error");
      }
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

  const upsertQuestion = async (
    existingQuestionId: string | null,
    body: {
      prompt: string;
      questionText?: string;
      narrativeIntro?: string | null;
      answerStyle?: "RADIO" | "CARD_GRID" | "SLIDER" | "CHAT";
      answerOptionsMeta?: Array<{ label: string; microCopy?: string; iconToken?: string; traitScore?: number }>;
      type: "chat" | "quiz";
      options?: string[];
    }
  ) => {
    if (!selectedTraitId) return;
    if (existingQuestionId) {
      await request<{ data: TraitQuestion }>(`/api/admin/questions/${existingQuestionId}`, {
        method: "PUT",
        body: JSON.stringify(body)
      });
      return;
    }
    await request<{ data: TraitQuestion }>(`/api/admin/traits/${selectedTraitId}/questions`, {
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
      const payload = await request<{
        data: { positiveSignals: string[]; negativeSignals: string[]; followUps: string[] };
      }>(`/api/admin/traits/${selectedTraitId}/generate-signals`, { method: "POST" });
      const { positiveSignals: pos, negativeSignals: neg, followUps: follow } = payload.data;
      setRubricDraft({
        positiveSignals: (pos ?? []).slice(0, 3),
        negativeSignals: (neg ?? []).slice(0, 3),
        followUps: (follow ?? []).slice(0, 2)
      });
    } catch (error) {
      setTraitError(error instanceof Error ? error.message : "Failed to generate rubric with AI.");
    } finally {
      setGeneratingRubric(false);
    }
  };

  const applyRubricDraft = () => {
    if (!rubricDraft) return;
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
      const payload = await request<{
        data: { chatPrompt: string; quizPrompt: string; quizOptions: string[] };
      }>(`/api/admin/traits/${selectedTraitId}/generate-questions`, { method: "POST" });
      const quizDraftMeta = canonicalQuizOptions.map((label, index) => ({
        label,
        microCopy:
          index === 0 ? "Just getting started" : index === 1 ? "Building consistency" : index === 2 ? "Strong in practice" : "Clear standout",
        iconToken: ["seedling", "wrench", "target", "crown"][index] ?? "spark",
        traitScore: index + 1
      }));
      return {
        quiz: {
          narrativeIntro: selectedTrait?.definition ?? "",
          questionText: payload.data.quizPrompt,
          answerStyle: "CARD_GRID" as const,
          optionMeta: quizDraftMeta
        },
        chat: {
          chatQuestion1: payload.data.chatPrompt,
          chatQuestion2: `Tell me about another example where you showed ${selectedTrait?.name.toLowerCase() ?? "this trait"}.`,
          rubricFollowUps: form.rubricFollowUps
        }
      };
    } catch (error) {
      setTraitError(error instanceof Error ? error.message : "Failed to generate questions with AI.");
      throw error;
    } finally {
      setGeneratingQuestionsDraft(false);
    }
  };

  const saveQuizDesign = async (input: {
    narrativeIntro: string;
    questionText: string;
    answerStyle: "RADIO" | "CARD_GRID" | "SLIDER";
    optionMeta: Array<{ label: string; microCopy: string; iconToken: string; traitScore: number }>;
  }) => {
    if (!selectedTraitId) return;
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

  const saveChatDesign = async (input: { chatQuestion1: string; chatQuestion2: string; rubricFollowUps: string }) => {
    if (!selectedTraitId) return;
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

  const generateExperienceDraftWithAi = async (action: "generate" | "gen_z" | "simplify" | "aspirational") => {
    if (!selectedTraitId) return;
    setGeneratingExperienceDraft(true);
    setTraitError(null);
    try {
      const payload = await request<{
        data: {
          publicLabel: string;
          oneLineHook: string;
          archetypeTag: ArchetypeTag;
          displayIcon: string;
          visualMood: TraitVisualMood;
        };
      }>(`/api/admin/traits/${selectedTraitId}/experience-draft`, {
        method: "POST",
        body: JSON.stringify({ action })
      });
      setExperienceDraft(payload.data);
    } catch (error) {
      setTraitError(error instanceof Error ? error.message : "Failed to generate experience draft with AI.");
    } finally {
      setGeneratingExperienceDraft(false);
    }
  };

  const applyExperienceDraft = () => {
    if (!experienceDraft) return;
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

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Traits Library</h2>
        <div className="space-y-2">
          <button
            type="button"
            className={`${subtleButtonClass} w-full disabled:cursor-not-allowed disabled:opacity-60`}
            onClick={startCreateTrait}
            disabled={isCreatingDraft}
            aria-busy={isCreatingDraft ? "true" : undefined}
          >
            {isCreatingDraft ? "Saving..." : "+ New Trait"}
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
          {!loading && sortedTraits.length === 0 && (
            <p className="text-sm text-slate-500">
              {search.trim() || categoryFilter !== "ALL"
                ? "No traits match your search or category filter."
                : "No traits yet. Create your first trait."}
            </p>
          )}
          {sortedTraits.map((trait) => (
            <TraitLibraryRow
              key={trait.id}
              trait={trait}
              loading={loading}
              selected={selectedTraitId === trait.id}
              onSelect={() => startEditTrait(trait)}
              onOpenPrograms={() => setProgramDrawerTraitId(trait.id)}
            />
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-6">
        {/* Mobile: collapsible Programs accordion above main content */}
        {selectedTrait && (
          <div className="lg:hidden">
            <TraitProgramsAccordion
              programs={selectedTraitPrograms}
              loading={selectedTraitProgramsLoading}
              error={selectedTraitProgramsError}
              onManage={() => setProgramDrawerTraitId(selectedTrait.id)}
              onProgramClick={(programId) => {
                window.sessionStorage.setItem("pmm:selectedProgramId", programId);
                navigate("/programs");
              }}
            />
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
          <div className="min-w-0">
            <div className="space-y-6">
              <TraitHeader
                name={form.name}
                category={form.category}
                status={form.status}
                editorStatusLabel={editorStatusLabel}
                isSaving={editorSaveStatus === "saving" || isCreatingDraft}
                onSave={() => void submitTrait()}
                onDelete={() => selectedTrait && void deleteTrait(selectedTrait.id)}
                showDelete={Boolean(selectedTrait)}
              />

              <TraitDefinitionSection
                form={form}
                setForm={setForm}
                titleInputRef={titleInputRef}
                actionableMissing={actionableMissing}
                showActivationNotice={showActivationNotice}
                isEditing={isEditing}
                experienceDraft={experienceDraft}
                generatingExperienceDraft={generatingExperienceDraft}
                onGenerateExperienceDraft={(action) => void generateExperienceDraftWithAi(action)}
                onApplyExperienceDraft={applyExperienceDraft}
                onDiscardExperienceDraft={discardExperienceDraft}
              />

              <TraitScoringInterviewSection>
                <TraitRubricEditor
                  isEditing={isEditing}
                  generatingRubric={generatingRubric}
                  onGenerateRubricWithAi={() => void generateRubricWithAi()}
                  rubricDraft={rubricDraft}
                  onApplyRubricDraft={applyRubricDraft}
                  onDiscardRubricDraft={discardRubricDraft}
                  positiveSignals={positiveSignals}
                  negativeSignals={negativeSignals}
                  followUps={followUps}
                  setForm={setForm}
                />
                <TraitQuestionsEditor
                  selectedTrait={selectedTrait}
                  generatingQuestionsDraft={generatingQuestionsDraft}
                  onGenerateQuestionsDraftWithAi={generateQuestionsDraftWithAi}
                  onSaveQuizDesign={saveQuizDesign}
                  onSaveChatDesign={saveChatDesign}
                  questions={questions}
                  rubricFollowUps={form.rubricFollowUps}
                />
              </TraitScoringInterviewSection>

              {traitNotice && <p className="text-sm text-emerald-700">{traitNotice}</p>}
              {traitError && <p className="text-sm text-red-700">{traitError}</p>}
            </div>
          </div>

          <TraitProgramsSidebar
            selectedTrait={selectedTrait}
            selectedTraitPrograms={selectedTraitPrograms}
            selectedTraitProgramsLoading={selectedTraitProgramsLoading}
            selectedTraitProgramsError={selectedTraitProgramsError}
            onManage={() => selectedTrait && setProgramDrawerTraitId(selectedTrait.id)}
            onProgramClick={(programId) => {
              window.sessionStorage.setItem("pmm:selectedProgramId", programId);
              navigate("/programs");
            }}
          />
        </div>
      </div>
      <TraitProgramsDrawer
        open={programDrawerTraitId !== null}
        trait={traits.find((trait) => trait.id === programDrawerTraitId) ?? null}
        onClose={() => setProgramDrawerTraitId(null)}
        onProgramOpen={(programId) => {
          window.sessionStorage.setItem("pmm:selectedProgramId", programId);
          navigate("/programs");
        }}
        onAssociationsChanged={() => {
          void loadTraits();
          if (selectedTraitId === programDrawerTraitId && programDrawerTraitId) {
            void loadTraitPrograms(programDrawerTraitId);
          }
        }}
      />
    </div>
  );
}

function TraitLibraryRow({
  trait,
  selected,
  onSelect,
  loading,
  onOpenPrograms
}: {
  trait: Trait;
  selected: boolean;
  loading: boolean;
  onSelect: () => void;
  onOpenPrograms: () => void;
}) {
  const status = mapTraitListStatus(trait.status);
  const statusMeta = traitListStatusMeta[status];
  const programCount = trait.programSummary?.count ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      data-testid={`trait-row-${trait.id}`}
      aria-current={selected ? "true" : undefined}
      className={`group relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700 ${
        selected ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">{trait.name}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{trait.category}</div>
          {!loading && (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              onClick={(event) => {
                event.stopPropagation();
                onOpenPrograms();
              }}
            >
              {programCount === 0 ? "Not linked" : `${programCount} program${programCount === 1 ? "" : "s"}`}
            </button>
          )}
          {loading && <span className="mt-1 inline-block h-4 w-24 animate-pulse rounded bg-slate-200" />}
        </div>
        <div className={`mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${statusMeta.textClassName}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClassName}`} />
          <span>{statusMeta.label}</span>
        </div>
      </div>
    </div>
  );
}

function TraitProgramsDrawer({
  open,
  trait,
  onClose,
  onProgramOpen,
  onAssociationsChanged
}: {
  open: boolean;
  trait: Trait | null;
  onClose: () => void;
  onProgramOpen: (programId: string) => void;
  onAssociationsChanged: () => void;
}) {
  const [associations, setAssociations] = useState<TraitProgramAssociation[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programSearch, setProgramSearch] = useState("");
  const [selectedProgramToAdd, setSelectedProgramToAdd] = useState<string>("");
  const [newBucket, setNewBucket] = useState<ProgramTraitPriorityBucket>("IMPORTANT");
  const [newWeight, setNewWeight] = useState("0.50");

  useEffect(() => {
    if (!open || !trait) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [assocPayload, programPayload] = await Promise.all([
          request<{ data: Array<Partial<TraitProgramAssociation> & { programId: string }> }>(`/api/admin/traits/${trait.id}/programs`),
          request<{ data: Program[] }>("/api/admin/programs")
        ]);
        setAssociations(assocPayload.data.map((item) => normalizeTraitProgramAssociation(item)));
        setAllPrograms(programPayload.data.map((program) => normalizeProgram(program)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load associated programs.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [open, trait]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
    if (!open) return;
    const firstOption = availablePrograms[0]?.id ?? "";
    setSelectedProgramToAdd(firstOption);
  }, [open, availablePrograms]);

  const persistPatch = async (programId: string, patch: { bucket?: ProgramTraitPriorityBucket; weight?: number }) => {
    if (!trait) return;
    const previous = associations;
    setAssociations((current) =>
      current.map((item) =>
        item.programId === programId
          ? {
              ...item,
              ...(patch.bucket ? { bucket: patch.bucket } : {}),
              ...(patch.weight !== undefined ? { weight: patch.weight } : {})
            }
          : item
      )
    );
    setSaving(true);
    setError(null);
    try {
      await request<{ data: TraitProgramAssociation }>(`/api/admin/traits/${trait.id}/programs/${programId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      onAssociationsChanged();
    } catch (patchError) {
      setAssociations(previous);
      setError(patchError instanceof Error ? patchError.message : "Failed to update association.");
    } finally {
      setSaving(false);
    }
  };

  const addAssociation = async () => {
    if (!trait || !selectedProgramToAdd) return;
    const selectedProgram = allPrograms.find((program) => program.id === selectedProgramToAdd);
    if (!selectedProgram) return;
    const optimistic: TraitProgramAssociation = {
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
      const payload = await request<{ data: TraitProgramAssociation }>(`/api/admin/traits/${trait.id}/programs`, {
        method: "POST",
        body: JSON.stringify({
          programId: selectedProgram.id,
          bucket: newBucket,
          weight: Number(newWeight)
        })
      });
      setAssociations((current) =>
        current.map((item) => (item.programId === optimistic.programId ? payload.data : item))
      );
      setProgramSearch("");
      setNewBucket("IMPORTANT");
      setNewWeight("0.50");
      onAssociationsChanged();
    } catch (addError) {
      setAssociations(previous);
      setError(addError instanceof Error ? addError.message : "Failed to add program association.");
    } finally {
      setSaving(false);
    }
  };

  const removeAssociation = async (programId: string) => {
    if (!trait) return;
    const target = associations.find((item) => item.programId === programId);
    if (!target) return;
    const approved = window.confirm(`Remove ${target.programName} from ${trait.name}?`);
    if (!approved) return;
    const previous = associations;
    setAssociations((current) => current.filter((item) => item.programId !== programId));
    setSaving(true);
    setError(null);
    try {
      await request<{ ok: boolean }>(`/api/admin/traits/${trait.id}/programs/${programId}`, { method: "DELETE" });
      onAssociationsChanged();
    } catch (deleteError) {
      setAssociations(previous);
      setError(deleteError instanceof Error ? deleteError.message : "Failed to remove association.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !trait) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="presentation" onClick={onClose}>
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Trait associated programs"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{trait.name}</h2>
            <p className="text-sm text-slate-500">{trait.category}</p>
          </div>
          <button type="button" className="text-sm text-slate-600 hover:text-slate-900" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className={labelClass}>Add Program</label>
              <input
                className={inputClass}
                placeholder="Search programs..."
                value={programSearch}
                onChange={(event) => setProgramSearch(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Bucket</label>
              <select className={inputClass} value={newBucket} onChange={(event) => setNewBucket(event.target.value as ProgramTraitPriorityBucket)}>
                {programTraitPriorityBuckets.map((bucket) => (
                  <option key={bucket} value={bucket}>
                    {bucket}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Weight</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={newWeight}
                onChange={(event) => setNewWeight(event.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className={`${inputClass} max-w-md`}
              value={selectedProgramToAdd}
              onChange={(event) => setSelectedProgramToAdd(event.target.value)}
            >
              {availablePrograms.length === 0 && <option value="">No available programs</option>}
              {availablePrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={saving || availablePrograms.length === 0 || !selectedProgramToAdd}
              onClick={() => void addAssociation()}
            >
              Add Program
            </Button>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          {loading ? (
            <p className="text-sm text-slate-500">Loading associated programs…</p>
          ) : associations.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              <p>Not linked</p>
              <p className="mt-1 text-xs text-slate-500">Link this trait to a program to control scoring priority.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Program</th>
                    <th className="px-3 py-2 font-medium">Priority Bucket</th>
                    <th className="px-3 py-2 font-medium">Weight</th>
                    <th className="px-3 py-2 font-medium">Updated At</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {associations.map((item) => (
                    <tr key={item.programId} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-slate-700 underline hover:text-slate-900"
                          onClick={() => onProgramOpen(item.programId)}
                        >
                          {item.programName}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          value={item.bucket}
                          onChange={(event) =>
                            void persistPatch(item.programId, { bucket: event.target.value as ProgramTraitPriorityBucket })
                          }
                        >
                          {programTraitPriorityBuckets.map((bucket) => (
                            <option key={bucket} value={bucket}>
                              {bucket}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          defaultValue={item.weight.toFixed(2)}
                          onBlur={(event) => {
                            const parsed = Number(event.target.value);
                            if (!Number.isFinite(parsed)) {
                              event.target.value = item.weight.toFixed(2);
                              return;
                            }
                            const clamped = Math.max(0, Math.min(1, parsed));
                            event.target.value = clamped.toFixed(2);
                            if (Math.abs(clamped - item.weight) < 0.001) return;
                            void persistPatch(item.programId, { weight: clamped });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{new Date(item.updatedAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:text-red-700"
                          onClick={() => void removeAssociation(item.programId)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ProgramLibraryRow({
  program,
  selected,
  onSelect
}: {
  program: Program;
  selected: boolean;
  onSelect: () => void;
}) {
  const secondary = program.department?.trim() || program.degreeLevel?.trim() || "No department";
  const statusMeta = programListStatusMeta[mapProgramListStatus(program)];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      data-testid={`program-row-${program.id}`}
      className={[
        "group relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700",
        selected ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50"
      ].join(" ")}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">{program.name}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{secondary}</div>
        </div>
        <div className={`mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${statusMeta.textClassName}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClassName}`} />
          <span>{statusMeta.label}</span>
        </div>
      </div>
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
    department: "",
    isActive: false
  });
  const [programSearch, setProgramSearch] = useState("");
  const [debouncedProgramSearch, setDebouncedProgramSearch] = useState("");
  const [programsLoading, setProgramsLoading] = useState(false);
  const [isCreatingProgramDraft, setIsCreatingProgramDraft] = useState(false);
  const [traitModalOpen, setTraitModalOpen] = useState(false);
  const [removingTrait, setRemovingTrait] = useState<BoardTrait | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<ProgramTraitPriorityBucket>>(
    () => new Set(["CRITICAL", "VERY_IMPORTANT", "IMPORTANT"])
  );
  const cancelRemoveButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmRemoveButtonRef = useRef<HTMLButtonElement | null>(null);
  const programNameInputRef = useRef<HTMLInputElement | null>(null);
  const focusProgramNameOnSelectRef = useRef(false);

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
      programForm.department !== (selectedProgram.department ?? "") ||
      programForm.isActive !== selectedProgram.isActive
    );
  }, [selectedProgram, programForm]);

  const pageDirty = programDirty || boardDirty;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [programStatusFilter, setProgramStatusFilter] = useState<"ALL" | "INACTIVE">("ALL");
  const [statusToast, setStatusToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [statusToggleInFlight, setStatusToggleInFlight] = useState<string | null>(null);
  const statusToastTimerRef = useRef<number | null>(null);
  const inactiveProgramCount = useMemo(
    () => programs.filter((program) => mapProgramListStatus(program) === "INACTIVE").length,
    [programs]
  );
  const filteredPrograms = useMemo(() => {
    const q = debouncedProgramSearch.trim().toLowerCase();
    const statusFiltered =
      programStatusFilter === "INACTIVE"
        ? programs.filter((program) => mapProgramListStatus(program) === "INACTIVE")
        : programs;
    const sorted = [...statusFiltered].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter((program) => {
      const nameMatch = program.name.toLowerCase().includes(q);
      const departmentMatch = (program.department ?? "").toLowerCase().includes(q);
      return nameMatch || departmentMatch;
    });
  }, [programs, debouncedProgramSearch, programStatusFilter]);

  const loadPrograms = async () => {
    setProgramsLoading(true);
    try {
      const payload = await request<{ data: Program[] }>("/api/admin/programs");
      const normalizedPrograms = payload.data.map((program) => normalizeProgram(program));
      const preferredProgramId = window.sessionStorage.getItem("pmm:selectedProgramId");
      setPrograms(normalizedPrograms);
      if (
        normalizedPrograms.length > 0 &&
        preferredProgramId &&
        normalizedPrograms.some((program) => program.id === preferredProgramId)
      ) {
        setSelectedProgramId(preferredProgramId);
        window.sessionStorage.removeItem("pmm:selectedProgramId");
      } else if (normalizedPrograms.length > 0 && !normalizedPrograms.some((program) => program.id === selectedProgramId)) {
        setSelectedProgramId(normalizedPrograms[0]?.id ?? null);
      }
      if (normalizedPrograms.length === 0) {
        setSelectedProgramId(null);
        const empty = createEmptyProgramBoardState();
        setBoard(empty);
        setSavedBoard(empty);
      }
    } finally {
      setProgramsLoading(false);
    }
  };

  const loadTraits = async () => {
    const payload = await request<{ data: Trait[] }>("/api/admin/traits");
    setTraits(payload.data.map((trait) => normalizeTrait(trait)));
  };

  const loadProgramTraits = async (programId: string) => {
    const payload = await request<{ data: ProgramTrait[] }>(`/api/admin/programs/${programId}/traits`);
    const nextState: ProgramBoardState = createEmptyProgramBoardState();

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
    if (!selectedProgramId || !focusProgramNameOnSelectRef.current) return;
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

  const showStatusToast = (toast: { type: "success" | "error"; message: string }) => {
    if (statusToastTimerRef.current !== null) {
      window.clearTimeout(statusToastTimerRef.current);
    }
    setStatusToast(toast);
    statusToastTimerRef.current = window.setTimeout(() => {
      setStatusToast(null);
      statusToastTimerRef.current = null;
    }, 2400);
  };

  const toggleProgramActive = async (programId: string, nextIsActive: boolean) => {
    if (statusToggleInFlight) return;

    const previous = programs.find((program) => program.id === programId);
    if (!previous) return;

    setStatusToggleInFlight(programId);
    setPrograms((current) =>
      current.map((program) =>
        program.id === programId ? { ...program, isActive: nextIsActive, updatedAt: new Date().toISOString() } : program
      )
    );

    try {
      const payload = await request<{ data: Program }>(`/api/admin/programs/${programId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextIsActive })
      });
      const normalized = normalizeProgram(payload.data);
      setPrograms((current) => current.map((program) => (program.id === programId ? normalized : program)));
      showStatusToast({
        type: "success",
        message: `Program marked ${normalized.isActive ? "Active" : "Inactive"}.`
      });
    } catch (error) {
      setPrograms((current) => current.map((program) => (program.id === programId ? previous : program)));
      showStatusToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update program status."
      });
    } finally {
      setStatusToggleInFlight(null);
    }
  };

  const createProgram = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = await request<{ data: Program }>("/api/admin/programs", {
      method: "POST",
      body: JSON.stringify(programForm)
    });
    await loadPrograms();
    setSelectedProgramId(normalizeProgram(payload.data).id);
  };

  const startNewProgram = async () => {
    if (isCreatingProgramDraft) return;
    const untitledBase = "Untitled program";
    const untitledNames = new Set(
      programs
        .map((program) => program.name)
        .filter((name) => name === untitledBase || /^Untitled program \d+$/.test(name))
    );
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
      const payload = await request<{ data: Program }>("/api/admin/programs", {
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
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to create program.");
      setSaveStatus("error");
    } finally {
      setIsCreatingProgramDraft(false);
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

  const nonActiveBoardTraits = useMemo(() => {
    const items: Array<{ id: string; name: string; status: TraitStatus }> = [];
    const seen = new Set<string>();
    for (const bucket of programTraitPriorityBuckets) {
      for (const trait of board[bucket]) {
        if (seen.has(trait.id)) continue;
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
    const uniqueTraits = new Map<string, TraitStatus>();
    for (const bucket of programTraitPriorityBuckets) {
      for (const trait of board[bucket]) {
        if (!uniqueTraits.has(trait.id)) {
          uniqueTraits.set(trait.id, trait.status ?? "DRAFT");
        }
      }
    }

    const totalTraits = uniqueTraits.size;
    const activeTraits = [...uniqueTraits.values()].filter((status) => status === "ACTIVE").length;
    const missing: string[] = [];
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

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(16rem,18rem)_minmax(18rem,22rem)_minmax(0,1fr)]">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Programs</h2>
          <button
            type="button"
            onClick={() => void startNewProgram()}
            disabled={isCreatingProgramDraft}
            aria-busy={isCreatingProgramDraft ? "true" : undefined}
            className={`${subtleButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isCreatingProgramDraft ? "Saving..." : "+ New Program"}
          </button>
        </div>
        <div className="space-y-2">
          {inactiveProgramCount > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>
                {inactiveProgramCount} program{inactiveProgramCount !== 1 ? "s are" : " is"} Inactive and will not be used in
                matchmaking.
              </p>
              <button
                type="button"
                className="mt-1 font-semibold underline"
                onClick={() => setProgramStatusFilter((current) => (current === "INACTIVE" ? "ALL" : "INACTIVE"))}
              >
                {programStatusFilter === "INACTIVE" ? "Show all" : "Show inactive"}
              </button>
            </div>
          )}
          <input
            className={inputClass}
            placeholder="Search programs..."
            value={programSearch}
            onChange={(event) => setProgramSearch(event.target.value)}
          />
          {programStatusFilter === "INACTIVE" && (
            <p className="text-xs text-slate-600">Filtering to Inactive programs.</p>
          )}
          {programsLoading && <p className="text-sm text-slate-500">Loading...</p>}
          {!programsLoading && programs.length === 0 && (
            <p className="text-sm text-slate-500">No programs yet. Create one to begin.</p>
          )}
          {!programsLoading && programs.length > 0 && filteredPrograms.length === 0 && (
            <div className="text-sm text-slate-500">
              <p>No programs found.</p>
              <button
                type="button"
                className="mt-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                onClick={() => setProgramSearch("")}
              >
                Clear search
              </button>
            </div>
          )}
          {filteredPrograms.map((program) => (
            <ProgramLibraryRow
              key={program.id}
              program={program}
              selected={selectedProgramId === program.id}
              onSelect={() => setSelectedProgramId(program.id)}
            />
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
              ref={programNameInputRef}
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
          <div>
            <label className={labelClass}>Active</label>
            <div className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2">
              <span className="text-sm text-slate-700">Active programs are included in matchmaking.</span>
              <button
                type="button"
                role="switch"
                aria-checked={programForm.isActive}
                aria-label="Active"
                disabled={!selectedProgram || statusToggleInFlight === selectedProgram.id}
                onClick={() => {
                  if (!selectedProgram) return;
                  const nextValue = !programForm.isActive;
                  setProgramForm((prev) => ({ ...prev, isActive: nextValue }));
                  void toggleProgramActive(selectedProgram.id, nextValue);
                }}
                className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  programForm.isActive ? "bg-emerald-600" : "bg-slate-300"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span
                  className={`inline-block h-5 w-5 shrink-0 transform rounded-full bg-white transition-transform ${
                    programForm.isActive ? "translate-x-[22px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
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
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between bg-white pb-2">
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
          <div className="flex min-h-[20rem] flex-col gap-4 pb-2">
            {!programScoringReadiness.isScorable && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">This program cannot be scored yet.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {programScoringReadiness.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {programScoringReadiness.isScorable && nonActiveBoardTraits.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">
                  {nonActiveBoardTraits.length} trait{nonActiveBoardTraits.length !== 1 ? "s are" : " is"} not Active and will not affect scoring.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {nonActiveBoardTraits.map((trait) => (
                    <li key={trait.id}>
                      {trait.name} ({trait.status.replaceAll("_", " ")})
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] ${traitStatusTone[trait.status as TraitStatus]}`}>
                                {(trait.status as TraitStatus).replaceAll("_", " ")}
                              </span>
                              {trait.status !== "ACTIVE" && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                                  Excluded from scoring
                                </span>
                              )}
                            </div>
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
      {statusToast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 rounded-md px-4 py-2 text-sm text-white shadow-lg ${
            statusToast.type === "success" ? "bg-emerald-700" : "bg-red-700"
          }`}
        >
          {statusToast.message}
        </div>
      )}
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

type QuizExperienceConfig = {
  id: string;
  headline: string;
  subheadline: string;
  estimatedTimeLabel: string;
  tonePreset: string;
  gradientSet: string;
  motionIntensity: "LOW" | "MEDIUM" | "HIGH";
  rankingMotionStyle: string;
  revealStyle: string;
  introMediaPrompt: string | null;
  revealMediaPrompt: string | null;
};

export function QuizExperiencePage() {
  const [form, setForm] = useState<QuizExperienceConfig>({
    id: "default",
    headline: "Discover your best-fit graduate path",
    subheadline: "A quick, personality-first quiz to see where you thrive.",
    estimatedTimeLabel: "3-5 min",
    tonePreset: "GEN_Z_FRIENDLY",
    gradientSet: "SUNRISE",
    motionIntensity: "MEDIUM",
    rankingMotionStyle: "SPRING",
    revealStyle: "IDENTITY",
    introMediaPrompt: "",
    revealMediaPrompt: ""
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const payload = await request<{ data: QuizExperienceConfig }>("/api/admin/quiz-experience");
      setForm(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quiz experience config.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await request<{ data: QuizExperienceConfig }>("/api/admin/quiz-experience", {
        method: "PUT",
        body: JSON.stringify(form)
      });
      setForm(payload.data);
      setNotice("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quiz experience config.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Quiz Experience</h2>
        {loading && <p className="mb-2 text-sm text-slate-500">Loading...</p>}
        <form className="space-y-3" onSubmit={(event) => void save(event)}>
          <div>
            <label className={labelClass}>Hook Headline</label>
            <input className={inputClass} value={form.headline} onChange={(event) => setForm((prev) => ({ ...prev, headline: event.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Hook Subheadline</label>
            <textarea className={inputClass} value={form.subheadline} onChange={(event) => setForm((prev) => ({ ...prev, subheadline: event.target.value }))} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Estimated Time</label>
              <input className={inputClass} value={form.estimatedTimeLabel} onChange={(event) => setForm((prev) => ({ ...prev, estimatedTimeLabel: event.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Tone Preset</label>
              <input className={inputClass} value={form.tonePreset} onChange={(event) => setForm((prev) => ({ ...prev, tonePreset: event.target.value }))} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Gradient Set</label>
              <input className={inputClass} value={form.gradientSet} onChange={(event) => setForm((prev) => ({ ...prev, gradientSet: event.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Motion Intensity</label>
              <select className={inputClass} value={form.motionIntensity} onChange={(event) => setForm((prev) => ({ ...prev, motionIntensity: event.target.value as "LOW" | "MEDIUM" | "HIGH" }))}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Ranking Motion Style</label>
              <input className={inputClass} value={form.rankingMotionStyle} onChange={(event) => setForm((prev) => ({ ...prev, rankingMotionStyle: event.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Reveal Style</label>
              <input className={inputClass} value={form.revealStyle} onChange={(event) => setForm((prev) => ({ ...prev, revealStyle: event.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Intro Media Prompt (optional)</label>
            <textarea className={inputClass} value={form.introMediaPrompt ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, introMediaPrompt: event.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Reveal Media Prompt (optional)</label>
            <textarea className={inputClass} value={form.revealMediaPrompt ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, revealMediaPrompt: event.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Quiz Experience"}</Button>
            {notice && <span className="text-sm text-emerald-700">{notice}</span>}
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">Live Preview</h3>
        <div className="rounded-xl bg-gradient-to-br from-orange-200 via-amber-100 to-rose-100 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-700">{form.estimatedTimeLabel}</p>
          <h4 className="mt-2 text-xl font-semibold text-slate-900">{form.headline}</h4>
          <p className="mt-2 text-sm text-slate-700">{form.subheadline}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
            <span className="rounded-full bg-white/80 px-2 py-1">Tone: {form.tonePreset}</span>
            <span className="rounded-full bg-white/80 px-2 py-1">Motion: {form.motionIntensity}</span>
            <span className="rounded-full bg-white/80 px-2 py-1">Reveal: {form.revealStyle}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

const rootElement = document.getElementById("root");
const isTestRuntime = import.meta.env.MODE === "test";
if (rootElement && !isTestRuntime) {
  const routerFuture = {
    v7_relativeSplatPath: true,
    ...( { v7_startTransition: true } as Record<string, boolean>)
  };
  const root =
    (rootElement as unknown as { _adminRoot?: ReturnType<typeof ReactDOM.createRoot> })._adminRoot ??
    ((rootElement as unknown as { _adminRoot?: ReturnType<typeof ReactDOM.createRoot> })._adminRoot =
      ReactDOM.createRoot(rootElement));

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={routerFuture}>
          <ShellLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/traits" replace />} />
              <Route path="/traits" element={<TraitsPage />} />
              <Route path="/programs" element={<ProgramsPage />} />
              <Route path="/brand-voice" element={<BrandVoicePage />} />
              <Route path="/quiz-experience" element={<QuizExperiencePage />} />
              <Route path="/widget/branding" element={<WidgetBrandingPage />} />
              <Route path="/widget/embed" element={<AdminWidgetEmbedPage />} />
              <Route path="/widget/preview" element={<AdminWidgetPreviewPage />} />
              <Route path="/widget/orchestration" element={<AdminWidgetOrchestrationPage />} />
              <Route path="*" element={<Navigate to="/traits" replace />} />
            </Routes>
          </ShellLayout>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

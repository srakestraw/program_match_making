import React from "react";

export type TraitProgramsPanelItem = {
  programId: string;
  programName: string;
  bucket: string;
  weight: number;
};

type TraitProgramsPanelProps = {
  programs: TraitProgramsPanelItem[];
  loading: boolean;
  error: string | null;
  onManage: () => void;
  onProgramClick?: (programId: string) => void;
  /** When true, omit outer container (for use inside accordion). */
  embedded?: boolean;
};

/**
 * Secondary reference panel: "Programs using this trait".
 * Used as a sticky right column on desktop and inside TraitProgramsAccordion on mobile.
 */
export function TraitProgramsPanel({
  programs,
  loading,
  error,
  onManage,
  onProgramClick,
  embedded = false
}: TraitProgramsPanelProps) {
  const count = programs.length;
  const sorted = [...programs].sort((a, b) => a.programName.localeCompare(b.programName));

  const content = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Programs using this trait
        </h2>
        <button
          type="button"
          className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
          onClick={onManage}
          aria-label="Manage associated programs"
        >
          Manage
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        {count === 1 ? "1 program" : `${count} programs`}
      </p>
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!loading && !error && sorted.length === 0 && (
        <p className="text-sm text-slate-600">No associated programs yet.</p>
      )}
      {!loading && !error && sorted.length > 0 && (
        <ul className="space-y-1.5">
          {sorted.map((item, index) => (
            <li
              key={`${item.programId}-${index}`}
              className="flex items-center justify-between gap-2 rounded border border-slate-200/80 bg-white px-2.5 py-1.5"
            >
              {onProgramClick ? (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm text-slate-700 underline hover:text-slate-900"
                  onClick={() => onProgramClick(item.programId)}
                >
                  {item.programName}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                  {item.programName}
                </span>
              )}
              <span className="shrink-0 text-xs text-slate-500">
                {item.bucket} · {item.weight.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (embedded) {
    return <div className="pt-0">{content}</div>;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4">
      {content}
    </div>
  );
}

type TraitProgramsAccordionProps = TraitProgramsPanelProps & {
  defaultExpanded?: boolean;
  /** For controlled open state (optional). */
  open?: boolean;
  onToggle?: (open: boolean) => void;
};

/**
 * Collapsible "Programs using this trait (N)" section for mobile/small screens.
 */
export function TraitProgramsAccordion({
  programs,
  loading,
  error,
  onManage,
  onProgramClick,
  defaultExpanded = false,
  open: controlledOpen,
  onToggle
}: TraitProgramsAccordionProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultExpanded);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onToggle?.(next);
  };

  const count = programs.length;
  const label = `Programs using this trait (${count})`;

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50/50">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100/80"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="trait-programs-accordion-content"
        id="trait-programs-accordion-heading"
      >
        <span>{label}</span>
        <span className="shrink-0 text-slate-400" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div
          id="trait-programs-accordion-content"
          role="region"
          aria-labelledby="trait-programs-accordion-heading"
          className="border-t border-slate-200/80 p-4"
        >
          <TraitProgramsPanel
            programs={programs}
            loading={loading}
            error={error}
            onManage={onManage}
            onProgramClick={onProgramClick}
            embedded
          />
        </div>
      )}
    </section>
  );
}

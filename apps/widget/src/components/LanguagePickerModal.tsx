import { useMemo, useState } from "react";
import type { LanguageOption } from "../constants/languages";

type LanguagePickerModalProps = {
  open: boolean;
  options: LanguageOption[];
  onClose: () => void;
  onSelect: (tag: string, label: string) => void;
};

export const LanguagePickerModal = ({ open, options, onClose, onSelect }: LanguagePickerModalProps) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query) || option.tag.toLowerCase().includes(query));
  }, [options, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Choose language</h3>
          <button type="button" className="text-xs text-slate-600 underline" onClick={onClose}>
            Close
          </button>
        </div>
        <input
          className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Type a language"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((option) => (
            <button
              key={option.tag}
              type="button"
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm hover:border-slate-900"
              onClick={() => {
                onSelect(option.tag, option.label);
                setSearch("");
              }}
            >
              {option.label}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-slate-500">No language matches your search.</p>}
        </div>
      </div>
    </div>
  );
};

import type { LanguageOption } from "../constants/languages";

type LanguagePillsProps = {
  valueTag: string;
  customLanguage?: LanguageOption | null;
  onChangeTag: (tag: string, label: string) => void;
  onOpenOther: () => void;
  options: LanguageOption[];
};

export const LanguagePills = ({ valueTag, customLanguage, onChangeTag, onOpenOther, options }: LanguagePillsProps) => {
  const isCustomSelected = Boolean(customLanguage && customLanguage.tag.toLowerCase() === valueTag.toLowerCase());
  const otherPillLabel = isCustomSelected ? customLanguage?.label ?? "Other" : "Other";

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="language-pills">
      {options.map((option) => {
        const selected = option.tag.toLowerCase() === valueTag.toLowerCase();
        return (
          <button
            key={option.tag}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => onChangeTag(option.tag, option.label)}
          >
            {option.label}
          </button>
        );
      })}
      <button
        type="button"
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          isCustomSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
        }`}
        onClick={onOpenOther}
        data-testid="language-pill-other"
      >
        {otherPillLabel}
      </button>
    </div>
  );
};

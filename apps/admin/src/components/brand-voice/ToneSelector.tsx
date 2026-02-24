import { brandVoiceTones } from "@pmm/domain";

const chipClass =
  "rounded-full border border-slate-300 px-3 py-1 text-xs font-medium transition hover:border-slate-500 hover:bg-slate-100";

const toneLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function ToneSelector({
  primaryTone,
  modifiers,
  onPrimaryToneChange,
  onModifiersChange
}: {
  primaryTone: string;
  modifiers: string[];
  onPrimaryToneChange: (value: string) => void;
  onModifiersChange: (value: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Primary Tone</label>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={primaryTone}
          onChange={(event) => onPrimaryToneChange(event.target.value)}
        >
          {brandVoiceTones.map((tone) => (
            <option key={tone} value={tone}>
              {toneLabel(tone)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-600">Tone Modifiers</label>
        <div className="flex flex-wrap gap-2">
          {brandVoiceTones.map((tone) => {
            const selected = modifiers.includes(tone);
            return (
              <button
                key={tone}
                type="button"
                className={`${chipClass} ${selected ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : ""}`}
                onClick={() =>
                  onModifiersChange(selected ? modifiers.filter((item) => item !== tone) : [...modifiers, tone])
                }
              >
                {toneLabel(tone)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

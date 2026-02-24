import { ToneProfile } from "@pmm/domain";

const sliderRows: Array<{ key: keyof ToneProfile; label: string; minLabel: string; maxLabel: string }> = [
  { key: "formality", label: "Formality", minLabel: "Casual", maxLabel: "Professional" },
  { key: "warmth", label: "Warmth", minLabel: "Neutral", maxLabel: "Friendly" },
  { key: "directness", label: "Directness", minLabel: "Soft", maxLabel: "Direct" },
  { key: "confidence", label: "Confidence", minLabel: "Reserved", maxLabel: "Assertive" },
  { key: "energy", label: "Energy", minLabel: "Calm", maxLabel: "Energetic" }
];

export function ToneSliders({
  value,
  onChange
}: {
  value: ToneProfile;
  onChange: (next: ToneProfile) => void;
}) {
  return (
    <div className="space-y-3">
      {sliderRows.map((row) => (
        <div key={row.key}>
          <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-600">
            <label>{row.label}</label>
            <span>{value[row.key]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={value[row.key]}
            className="w-full"
            onChange={(event) => onChange({ ...value, [row.key]: Number(event.target.value) })}
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{row.minLabel}</span>
            <span>{row.maxLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

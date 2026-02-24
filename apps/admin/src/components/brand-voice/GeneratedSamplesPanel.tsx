import { BrandVoiceSampleType } from "@pmm/domain";

type Samples = {
  headline: string;
  cta: string;
  email_intro: string;
  description: string;
};

const rows: Array<{ key: keyof Samples; label: string; type: BrandVoiceSampleType }> = [
  { key: "headline", label: "Headline", type: "headline" },
  { key: "cta", label: "CTA", type: "cta" },
  { key: "email_intro", label: "Email intro", type: "email_intro" },
  { key: "description", label: "Description", type: "description" }
];

export function GeneratedSamplesPanel({
  samples,
  onPin,
  onReplacePreview
}: {
  samples: Samples;
  onPin: (type: BrandVoiceSampleType, text: string) => void;
  onReplacePreview: (type: BrandVoiceSampleType, text: string) => void;
}) {
  return (
    <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-emerald-900">AI Suggestions</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="rounded-md border border-emerald-200 bg-white p-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{row.label}</p>
            <p className="mb-2 text-sm text-slate-800">{samples[row.key]}</p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                onClick={() => onPin(row.type, samples[row.key])}
              >
                Pin
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                onClick={() => void navigator.clipboard?.writeText(samples[row.key])}
              >
                Copy
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                onClick={() => onReplacePreview(row.type, samples[row.key])}
              >
                Replace Preview
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

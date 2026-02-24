import { BrandVoicePreviewSamples } from "@pmm/domain";

export function BrandVoicePreview({ title, samples }: { title: string; samples: BrandVoicePreviewSamples }) {
  const rows: Array<{ key: keyof BrandVoicePreviewSamples; label: string }> = [
    { key: "headline", label: "Headline" },
    { key: "cta", label: "CTA" },
    { key: "email_intro", label: "Email intro" },
    { key: "description", label: "Description" }
  ];

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{row.label}</p>
            <p className="text-sm text-slate-800">{samples[row.key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

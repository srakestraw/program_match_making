import React, { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@pmm/ui";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000";
const widgetBaseUrl =
  (import.meta.env.VITE_WIDGET_URL as string | undefined) ??
  (typeof window !== "undefined" ? `${window.location.origin.replace(/:\d+$/, ":5174")}` : "http://localhost:5174");

type WidgetThemeSource = "MANUAL" | "URL_SCRAPE" | "PRESET";
type WidgetThemeStatus = "DRAFT" | "ACTIVE";

type WidgetThemeTokens = {
  fontFamily: string;
  headingFontFamily?: string;
  colors: {
    primary: string;
    primaryHover: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
  };
  shadows?: {
    card?: string;
  };
  logoUrl?: string;
};

type WidgetTheme = {
  id: string | null;
  name: string;
  status: WidgetThemeStatus;
  source: WidgetThemeSource;
  sourceUrl: string | null;
  tokens: WidgetThemeTokens;
  createdAt: string | null;
  updatedAt: string | null;
};

const defaultTokens: WidgetThemeTokens = {
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  headingFontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  colors: {
    primary: "#0f172a",
    primaryHover: "#1e293b",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    mutedText: "#475569",
    border: "rgba(15, 23, 42, 0.14)"
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 14
  },
  shadows: {
    card: "0 8px 26px rgba(15, 23, 42, 0.08)"
  },
  logoUrl: ""
};

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600";

const coerceColorInput = (value: string) => {
  const hex = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#0f172a";
};

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error?.message === "string" ? data.error.message : typeof data?.error === "string" ? data.error : "Request failed";
    throw new Error(message);
  }
  return data as T;
};

export function WidgetBrandingPage() {
  const [mode, setMode] = useState<"manual" | "url">("manual");
  const [themeName, setThemeName] = useState("Widget Theme Draft");
  const [url, setUrl] = useState("");
  const [tokens, setTokens] = useState<WidgetThemeTokens>(defaultTokens);
  const [activeTheme, setActiveTheme] = useState<WidgetTheme | null>(null);
  const [draftTheme, setDraftTheme] = useState<WidgetTheme | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  const previewActiveUrl = useMemo(() => `${widgetBaseUrl.replace(/\/$/, "")}/?preview=1&theme=active`, []);
  const previewDraftUrl = useMemo(() => `${widgetBaseUrl.replace(/\/$/, "")}/?preview=1&theme=draft`, []);

  const loadThemes = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await request<{ data: { active: WidgetTheme | null; draft: WidgetTheme | null } }>("/api/admin/widget-theme");
      setActiveTheme(payload.data.active);
      setDraftTheme(payload.data.draft);
      const selected = payload.data.draft ?? payload.data.active;
      if (selected) {
        setThemeName(selected.name);
        setTokens(selected.tokens);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load widget themes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadThemes();
  }, []);

  const updateColor = (key: keyof WidgetThemeTokens["colors"], value: string) => {
    setTokens((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  };

  const generateFromUrl = async () => {
    if (!url.startsWith("https://")) {
      setError("URL must start with https://");
      return;
    }

    setSaving(true);
    setStatusMessage("Generating draft theme from URL...");
    setError(null);
    setWarnings([]);

    try {
      const payload = await request<{ data: WidgetTheme; warnings?: string[] }>("/api/admin/widget-theme/scrape", {
        method: "POST",
        body: JSON.stringify({ url })
      });
      setDraftTheme(payload.data);
      setTokens(payload.data.tokens);
      setThemeName(payload.data.name);
      setWarnings(payload.warnings ?? []);
      setStatusMessage("Draft generated from URL scrape.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate theme");
      setStatusMessage(null);
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    setStatusMessage("Saving draft theme...");
    setError(null);
    try {
      const payload = await request<{ data: WidgetTheme }>("/api/admin/widget-theme", {
        method: "POST",
        body: JSON.stringify({
          name: themeName.trim() || "Widget Theme Draft",
          source: mode === "url" ? "URL_SCRAPE" : "MANUAL",
          sourceUrl: mode === "url" && url.trim().length > 0 ? url.trim() : null,
          status: "DRAFT",
          tokens
        })
      });
      setDraftTheme(payload.data);
      setStatusMessage("Draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
      setStatusMessage(null);
    } finally {
      setSaving(false);
    }
  };

  const activateDraft = async () => {
    if (!draftTheme?.id) {
      setError("No draft theme is available to activate.");
      return;
    }

    setActivating(true);
    setStatusMessage("Activating draft theme...");
    setError(null);

    try {
      const payload = await request<{ data: WidgetTheme }>("/api/admin/widget-theme/activate", {
        method: "POST",
        body: JSON.stringify({ id: draftTheme.id })
      });
      setActiveTheme(payload.data);
      setStatusMessage("Draft activated.");
      await loadThemes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate draft");
      setStatusMessage(null);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Widget Branding</h1>
      <p className="text-sm text-slate-600">Build a manual theme or generate a draft from a university URL, preview it, and activate when ready.</p>

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Theme Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`rounded-md border px-3 py-2 text-sm ${mode === "manual" ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white"}`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setMode("url")}
                className={`rounded-md border px-3 py-2 text-sm ${mode === "url" ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white"}`}
              >
                Generate from URL
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Theme Name</label>
            <input className={inputClass} value={themeName} onChange={(event) => setThemeName(event.target.value)} placeholder="University Theme Draft" />
          </div>
        </div>

        {mode === "url" && (
          <div className="mt-4 space-y-2">
            <label className={labelClass}>Source URL (https)</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={inputClass} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.gsu.edu/" />
              <Button onClick={generateFromUrl} disabled={saving}>{saving ? "Generating..." : "Generate draft theme"}</Button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className={labelClass}>Font Family</label>
            <input className={inputClass} value={tokens.fontFamily} onChange={(event) => setTokens((prev) => ({ ...prev, fontFamily: event.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Heading Font Family (optional)</label>
            <input className={inputClass} value={tokens.headingFontFamily ?? ""} onChange={(event) => setTokens((prev) => ({ ...prev, headingFontFamily: event.target.value }))} />
          </div>
          {(
            [
              ["primary", "Primary"],
              ["primaryHover", "Primary Hover"],
              ["background", "Background"],
              ["surface", "Surface"],
              ["text", "Text"],
              ["mutedText", "Muted Text"],
              ["border", "Border"]
            ] as Array<[keyof WidgetThemeTokens["colors"], string]>
          ).map(([key, label]) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <div className="flex gap-2">
                <input type="color" className="h-10 w-12 rounded border border-slate-300 bg-white p-1" value={coerceColorInput(tokens.colors[key])} onChange={(event) => updateColor(key, event.target.value)} />
                <input className={inputClass} value={tokens.colors[key]} onChange={(event) => updateColor(key, event.target.value)} />
              </div>
            </div>
          ))}
          <div>
            <label className={labelClass}>Radius Small ({tokens.radii.sm}px)</label>
            <input type="range" min={0} max={32} value={tokens.radii.sm} onChange={(event) => setTokens((prev) => ({ ...prev, radii: { ...prev.radii, sm: Number(event.target.value) } }))} className="w-full" />
          </div>
          <div>
            <label className={labelClass}>Radius Medium ({tokens.radii.md}px)</label>
            <input type="range" min={0} max={40} value={tokens.radii.md} onChange={(event) => setTokens((prev) => ({ ...prev, radii: { ...prev.radii, md: Number(event.target.value) } }))} className="w-full" />
          </div>
          <div>
            <label className={labelClass}>Radius Large ({tokens.radii.lg}px)</label>
            <input type="range" min={0} max={56} value={tokens.radii.lg} onChange={(event) => setTokens((prev) => ({ ...prev, radii: { ...prev.radii, lg: Number(event.target.value) } }))} className="w-full" />
          </div>
          <div>
            <label className={labelClass}>Card Shadow (optional)</label>
            <input className={inputClass} value={tokens.shadows?.card ?? ""} onChange={(event) => setTokens((prev) => ({ ...prev, shadows: { card: event.target.value } }))} placeholder="0 8px 26px rgba(15,23,42,0.08)" />
          </div>
          <div>
            <label className={labelClass}>Logo URL (optional)</label>
            <input className={inputClass} value={tokens.logoUrl ?? ""} onChange={(event) => setTokens((prev) => ({ ...prev, logoUrl: event.target.value }))} placeholder="https://.../logo.svg" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={saveDraft} disabled={saving || loading}>{saving ? "Saving..." : "Save as Draft"}</Button>
          <Button className="bg-emerald-700" onClick={activateDraft} disabled={activating || !draftTheme?.id}>{activating ? "Activating..." : "Activate Draft"}</Button>
          {statusMessage && <span className="text-sm text-emerald-700">{statusMessage}</span>}
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>

        {warnings.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Generation warnings</p>
            <ul className="mt-1 list-disc pl-5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Preview: Draft vs Active</h2>
        <p className="mt-1 text-xs text-slate-600">Draft preview uses <code>?theme=draft</code>; active preview uses <code>?theme=active</code>.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Draft Theme</p>
            <div className="h-[520px] overflow-hidden rounded-md border border-slate-200">
              <iframe src={previewDraftUrl} title="Widget draft preview" className="h-full w-full bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" allow="microphone" />
            </div>
            <p className="text-xs text-slate-500">{draftTheme ? `${draftTheme.name} • ${draftTheme.updatedAt ?? ""}` : "No draft theme saved yet."}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Active Theme</p>
            <div className="h-[520px] overflow-hidden rounded-md border border-slate-200">
              <iframe src={previewActiveUrl} title="Widget active preview" className="h-full w-full bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" allow="microphone" />
            </div>
            <p className="text-xs text-slate-500">{activeTheme ? `${activeTheme.name} • ${activeTheme.updatedAt ?? ""}` : "No active theme yet (default fallback in use)."}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

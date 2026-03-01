import React, { useCallback, useMemo, useState } from "react";
import { Card } from "@pmm/ui";

const widgetBaseUrl =
  (import.meta.env.VITE_WIDGET_URL as string | undefined) ??
  (typeof window !== "undefined" ? `${window.location.origin.replace(/:\d+$/, ":5174")}` : "http://localhost:5174");

export function AdminWidgetEmbedPage() {
  const [voiceMode, setVoiceMode] = useState(true);
  const [languageSelectorVisible, setLanguageSelectorVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  const embedUrl = useMemo(() => {
    const url = new URL("/", widgetBaseUrl);
    if (voiceMode) url.searchParams.set("mode", "voice");
    if (!languageSelectorVisible) url.searchParams.set("lockLanguage", "1");
    return url.toString();
  }, [voiceMode, languageSelectorVisible]);

  const iframeSnippet = useMemo(
    () =>
      `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  title="Program Match Interview"
  allow="microphone"
></iframe>`,
    [embedUrl]
  );

  const scriptSnippet = useMemo(
    () =>
      `<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = "${embedUrl}";
  iframe.width = '100%';
  iframe.height = '600';
  iframe.title = 'Program Match Interview';
  iframe.allow = 'microphone';
  iframe.style.border = 'none';
  document.getElementById('pmm-widget-container').appendChild(iframe);
})();
</script>
<div id="pmm-widget-container"></div>`,
    [embedUrl]
  );

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Embed Widget</h1>
      <p className="text-sm text-slate-600">
        Use the snippet below to embed the Candidate Widget on your site. It uses current published traits and active
        programs; brand voice is applied server-side.
      </p>

      <Card>
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Configuration</h2>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={voiceMode}
                onChange={(e) => setVoiceMode(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Voice mode enabled</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={languageSelectorVisible}
                onChange={(e) => setLanguageSelectorVisible(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Language selector visible</span>
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Summary: {voiceMode ? "Voice interview" : "Chat/quiz"} •{" "}
            {languageSelectorVisible ? "Candidate can change language" : "Language locked to default"}
          </p>
        </section>
      </Card>

      <Card>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">Iframe embed</h2>
            <button
              type="button"
              onClick={() => void copyToClipboard(iframeSnippet)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
            <code>{iframeSnippet}</code>
          </pre>
        </section>
      </Card>

      <Card>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">Script embed (dynamic)</h2>
            <button
              type="button"
              onClick={() => void copyToClipboard(scriptSnippet)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Inserts the widget iframe into <code className="rounded bg-slate-200 px-1">#pmm-widget-container</code>.
            Embed code updates with the options above.
          </p>
          <pre className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
            <code>{scriptSnippet}</code>
          </pre>
        </section>
      </Card>
    </div>
  );
}

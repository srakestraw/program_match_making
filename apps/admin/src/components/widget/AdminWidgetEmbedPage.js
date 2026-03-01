import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
import { Card } from "@pmm/ui";
const widgetBaseUrl = import.meta.env.VITE_WIDGET_URL ??
    (typeof window !== "undefined" ? `${window.location.origin.replace(/:\d+$/, ":5174")}` : "http://localhost:5174");
export function AdminWidgetEmbedPage() {
    const [voiceMode, setVoiceMode] = useState(true);
    const [languageSelectorVisible, setLanguageSelectorVisible] = useState(true);
    const [copied, setCopied] = useState(false);
    const embedUrl = useMemo(() => {
        const url = new URL("/", widgetBaseUrl);
        if (voiceMode)
            url.searchParams.set("mode", "voice");
        if (!languageSelectorVisible)
            url.searchParams.set("lockLanguage", "1");
        return url.toString();
    }, [voiceMode, languageSelectorVisible]);
    const iframeSnippet = useMemo(() => `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  title="Program Match Interview"
  allow="microphone"
></iframe>`, [embedUrl]);
    const scriptSnippet = useMemo(() => `<script>
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
<div id="pmm-widget-container"></div>`, [embedUrl]);
    const copyToClipboard = useCallback(async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            setCopied(false);
        }
    }, []);
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Embed Widget" }), _jsx("p", { className: "text-sm text-slate-600", children: "Use the snippet below to embed the Candidate Widget on your site. It uses current published traits and active programs; brand voice is applied server-side." }), _jsx(Card, { children: _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-lg font-medium text-slate-900", children: "Configuration" }), _jsxs("div", { className: "flex flex-wrap gap-6", children: [_jsxs("label", { className: "flex cursor-pointer items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: voiceMode, onChange: (e) => setVoiceMode(e.target.checked), className: "rounded border-slate-300" }), _jsx("span", { className: "text-sm font-medium text-slate-700", children: "Voice mode enabled" })] }), _jsxs("label", { className: "flex cursor-pointer items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: languageSelectorVisible, onChange: (e) => setLanguageSelectorVisible(e.target.checked), className: "rounded border-slate-300" }), _jsx("span", { className: "text-sm font-medium text-slate-700", children: "Language selector visible" })] })] }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Summary: ", voiceMode ? "Voice interview" : "Chat/quiz", " \u2022", " ", languageSelectorVisible ? "Candidate can change language" : "Language locked to default"] })] }) }), _jsx(Card, { children: _jsxs("section", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-medium text-slate-900", children: "Iframe embed" }), _jsx("button", { type: "button", onClick: () => void copyToClipboard(iframeSnippet), className: "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50", children: copied ? "Copied" : "Copy" })] }), _jsx("pre", { className: "max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800", children: _jsx("code", { children: iframeSnippet }) })] }) }), _jsx(Card, { children: _jsxs("section", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-medium text-slate-900", children: "Script embed (dynamic)" }), _jsx("button", { type: "button", onClick: () => void copyToClipboard(scriptSnippet), className: "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50", children: copied ? "Copied" : "Copy" })] }), _jsxs("p", { className: "text-xs text-slate-600", children: ["Inserts the widget iframe into ", _jsx("code", { className: "rounded bg-slate-200 px-1", children: "#pmm-widget-container" }), ". Embed code updates with the options above."] }), _jsx("pre", { className: "max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800", children: _jsx("code", { children: scriptSnippet }) })] }) })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@pmm/ui";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const widgetBaseUrl = import.meta.env.VITE_WIDGET_URL ??
    (typeof window !== "undefined" ? `${window.location.origin.replace(/:\d+$/, ":5174")}` : "http://localhost:5174");
const defaultTokens = {
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
const coerceColorInput = (value) => {
    const hex = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#0f172a";
};
const request = async (path, init) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...init
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof data?.error?.message === "string" ? data.error.message : typeof data?.error === "string" ? data.error : "Request failed";
        throw new Error(message);
    }
    return data;
};
export function WidgetBrandingPage() {
    const [mode, setMode] = useState("manual");
    const [themeName, setThemeName] = useState("Widget Theme Draft");
    const [url, setUrl] = useState("");
    const [tokens, setTokens] = useState(defaultTokens);
    const [activeTheme, setActiveTheme] = useState(null);
    const [draftTheme, setDraftTheme] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [statusMessage, setStatusMessage] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activating, setActivating] = useState(false);
    const previewActiveUrl = useMemo(() => `${widgetBaseUrl.replace(/\/$/, "")}/?preview=1&theme=active`, []);
    const previewDraftUrl = useMemo(() => `${widgetBaseUrl.replace(/\/$/, "")}/?preview=1&theme=draft`, []);
    const loadThemes = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = await request("/api/admin/widget-theme");
            setActiveTheme(payload.data.active);
            setDraftTheme(payload.data.draft);
            const selected = payload.data.draft ?? payload.data.active;
            if (selected) {
                setThemeName(selected.name);
                setTokens(selected.tokens);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load widget themes");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void loadThemes();
    }, []);
    const updateColor = (key, value) => {
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
            const payload = await request("/api/admin/widget-theme/scrape", {
                method: "POST",
                body: JSON.stringify({ url })
            });
            setDraftTheme(payload.data);
            setTokens(payload.data.tokens);
            setThemeName(payload.data.name);
            setWarnings(payload.warnings ?? []);
            setStatusMessage("Draft generated from URL scrape.");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate theme");
            setStatusMessage(null);
        }
        finally {
            setSaving(false);
        }
    };
    const saveDraft = async () => {
        setSaving(true);
        setStatusMessage("Saving draft theme...");
        setError(null);
        try {
            const payload = await request("/api/admin/widget-theme", {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save draft");
            setStatusMessage(null);
        }
        finally {
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
            const payload = await request("/api/admin/widget-theme/activate", {
                method: "POST",
                body: JSON.stringify({ id: draftTheme.id })
            });
            setActiveTheme(payload.data);
            setStatusMessage("Draft activated.");
            await loadThemes();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to activate draft");
            setStatusMessage(null);
        }
        finally {
            setActivating(false);
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Widget Branding" }), _jsx("p", { className: "text-sm text-slate-600", children: "Build a manual theme or generate a draft from a university URL, preview it, and activate when ready." }), _jsxs(Card, { children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Theme Mode" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => setMode("manual"), className: `rounded-md border px-3 py-2 text-sm ${mode === "manual" ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white"}`, children: "Manual" }), _jsx("button", { type: "button", onClick: () => setMode("url"), className: `rounded-md border px-3 py-2 text-sm ${mode === "url" ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white"}`, children: "Generate from URL" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Theme Name" }), _jsx("input", { className: inputClass, value: themeName, onChange: (event) => setThemeName(event.target.value), placeholder: "University Theme Draft" })] })] }), mode === "url" && (_jsxs("div", { className: "mt-4 space-y-2", children: [_jsx("label", { className: labelClass, children: "Source URL (https)" }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row", children: [_jsx("input", { className: inputClass, value: url, onChange: (event) => setUrl(event.target.value), placeholder: "https://www.gsu.edu/" }), _jsx(Button, { onClick: generateFromUrl, disabled: saving, children: saving ? "Generating..." : "Generate draft theme" })] })] })), _jsxs("div", { className: "mt-4 grid gap-4 lg:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Font Family" }), _jsx("input", { className: inputClass, value: tokens.fontFamily, onChange: (event) => setTokens((prev) => ({ ...prev, fontFamily: event.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Heading Font Family (optional)" }), _jsx("input", { className: inputClass, value: tokens.headingFontFamily ?? "", onChange: (event) => setTokens((prev) => ({ ...prev, headingFontFamily: event.target.value })) })] }), [
                                ["primary", "Primary"],
                                ["primaryHover", "Primary Hover"],
                                ["background", "Background"],
                                ["surface", "Surface"],
                                ["text", "Text"],
                                ["mutedText", "Muted Text"],
                                ["border", "Border"]
                            ].map(([key, label]) => (_jsxs("div", { children: [_jsx("label", { className: labelClass, children: label }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "color", className: "h-10 w-12 rounded border border-slate-300 bg-white p-1", value: coerceColorInput(tokens.colors[key]), onChange: (event) => updateColor(key, event.target.value) }), _jsx("input", { className: inputClass, value: tokens.colors[key], onChange: (event) => updateColor(key, event.target.value) })] })] }, key))), _jsxs("div", { children: [_jsxs("label", { className: labelClass, children: ["Radius Small (", tokens.radii.sm, "px)"] }), _jsx("input", { type: "range", min: 0, max: 32, value: tokens.radii.sm, onChange: (event) => setTokens((prev) => ({ ...prev, radii: { ...prev.radii, sm: Number(event.target.value) } })), className: "w-full" })] }), _jsxs("div", { children: [_jsxs("label", { className: labelClass, children: ["Radius Medium (", tokens.radii.md, "px)"] }), _jsx("input", { type: "range", min: 0, max: 40, value: tokens.radii.md, onChange: (event) => setTokens((prev) => ({ ...prev, radii: { ...prev.radii, md: Number(event.target.value) } })), className: "w-full" })] }), _jsxs("div", { children: [_jsxs("label", { className: labelClass, children: ["Radius Large (", tokens.radii.lg, "px)"] }), _jsx("input", { type: "range", min: 0, max: 56, value: tokens.radii.lg, onChange: (event) => setTokens((prev) => ({ ...prev, radii: { ...prev.radii, lg: Number(event.target.value) } })), className: "w-full" })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Card Shadow (optional)" }), _jsx("input", { className: inputClass, value: tokens.shadows?.card ?? "", onChange: (event) => setTokens((prev) => ({ ...prev, shadows: { card: event.target.value } })), placeholder: "0 8px 26px rgba(15,23,42,0.08)" })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Logo URL (optional)" }), _jsx("input", { className: inputClass, value: tokens.logoUrl ?? "", onChange: (event) => setTokens((prev) => ({ ...prev, logoUrl: event.target.value })), placeholder: "https://.../logo.svg" })] })] }), _jsxs("div", { className: "mt-6 flex flex-wrap items-center gap-3", children: [_jsx(Button, { onClick: saveDraft, disabled: saving || loading, children: saving ? "Saving..." : "Save as Draft" }), _jsx(Button, { className: "bg-emerald-700", onClick: activateDraft, disabled: activating || !draftTheme?.id, children: activating ? "Activating..." : "Activate Draft" }), statusMessage && _jsx("span", { className: "text-sm text-emerald-700", children: statusMessage }), error && _jsx("span", { className: "text-sm text-red-700", children: error })] }), warnings.length > 0 && (_jsxs("div", { className: "mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900", children: [_jsx("p", { className: "font-semibold", children: "Generation warnings" }), _jsx("ul", { className: "mt-1 list-disc pl-5", children: warnings.map((warning) => (_jsx("li", { children: warning }, warning))) })] }))] }), _jsxs(Card, { children: [_jsx("h2", { className: "text-lg font-semibold text-slate-900", children: "Preview: Draft vs Active" }), _jsxs("p", { className: "mt-1 text-xs text-slate-600", children: ["Draft preview uses ", _jsx("code", { children: "?theme=draft" }), "; active preview uses ", _jsx("code", { children: "?theme=active" }), "."] }), _jsxs("div", { className: "mt-4 grid gap-4 lg:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium text-slate-700", children: "Draft Theme" }), _jsx("div", { className: "h-[520px] overflow-hidden rounded-md border border-slate-200", children: _jsx("iframe", { src: previewDraftUrl, title: "Widget draft preview", className: "h-full w-full bg-white", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups", allow: "microphone" }) }), _jsx("p", { className: "text-xs text-slate-500", children: draftTheme ? `${draftTheme.name} • ${draftTheme.updatedAt ?? ""}` : "No draft theme saved yet." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium text-slate-700", children: "Active Theme" }), _jsx("div", { className: "h-[520px] overflow-hidden rounded-md border border-slate-200", children: _jsx("iframe", { src: previewActiveUrl, title: "Widget active preview", className: "h-full w-full bg-white", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups", allow: "microphone" }) }), _jsx("p", { className: "text-xs text-slate-500", children: activeTheme ? `${activeTheme.name} • ${activeTheme.updatedAt ?? ""}` : "No active theme yet (default fallback in use)." })] })] })] })] }));
}

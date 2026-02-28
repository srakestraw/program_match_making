import React from "react";

const widgetBaseUrl =
  (import.meta.env.VITE_WIDGET_URL as string | undefined) ??
  (typeof window !== "undefined" ? `${window.location.origin.replace(/:\d+$/, ":5174")}` : "http://localhost:5174");

const previewUrl = `${widgetBaseUrl.replace(/\/$/, "")}/?preview=1`;

export function AdminWidgetPreviewPage() {
  return (
    <div className="relative -m-4 h-[calc(100vh-6rem)] min-h-[480px]">
      <span
        className="absolute right-4 top-4 z-10 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 shadow"
        aria-hidden
      >
        Preview Mode
      </span>
      <iframe
        src={previewUrl}
        title="Candidate Widget Preview"
        className="h-full w-full rounded-md border border-slate-200 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

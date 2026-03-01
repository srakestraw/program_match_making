import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const navLinkClass = "rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-200";

export function WidgetDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={navLinkClass}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Widget
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <Link
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            to="/widget/branding"
            role="menuitem"
          >
            Branding
          </Link>
          <Link
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            to="/widget/embed"
            role="menuitem"
          >
            Embed Widget
          </Link>
          <Link
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            to="/widget/preview"
            role="menuitem"
          >
            Candidate Preview
          </Link>
          <Link
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            to="/widget/orchestration"
            role="menuitem"
          >
            Orchestration
          </Link>
        </div>
      )}
    </div>
  );
}

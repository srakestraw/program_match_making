import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export const AppShell = ({ children }: PropsWithChildren) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>
);

export const Card = ({ children }: PropsWithChildren) => (
  <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
);

export const Button = ({ children, className = "", ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
  <button
    className={`rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  >
    {children}
  </button>
);

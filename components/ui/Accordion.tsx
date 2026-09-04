"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Accordion({
  title,
  right,
  children,
  defaultOpen = true,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            size={18}
            aria-hidden
            className={`text-[var(--muted)] transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
          <span className="text-[16px] font-bold text-[var(--ink)]">{title}</span>
        </span>
        {right}
      </button>
      {open && <div className="border-t border-[var(--border)]">{children}</div>}
    </section>
  );
}

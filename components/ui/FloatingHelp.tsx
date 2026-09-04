"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export function FloatingHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-6 right-6 z-40 print:hidden">
      {open && (
        <div className="card mb-3 w-72 p-4 text-[13px] leading-relaxed text-[var(--ink)]">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Help</span>
            <button
              type="button"
              aria-label="Close help"
              onClick={() => setOpen(false)}
              className="text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <p>
            Conflicts are flagged when a payer-policy source (MMIT) disagrees
            with existing account guidance. Resolve once at territory level,
            then communicate the corrected path to every impacted office.
          </p>
        </div>
      )}
      <button
        type="button"
        aria-label="Open help"
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--nav-bg)] text-white shadow-lg transition-transform hover:scale-105"
      >
        <HelpCircle size={24} aria-hidden />
      </button>
    </div>
  );
}

"use client";

// FRM Assistant — one FAQ row (Plan.md §11.2 #5).
// Collapsed: question + plus glyph. Expanded: plus → ✕, answer slides open.
// Click anywhere on the row (or Enter/Space when focused) toggles.

import { Plus, X } from "lucide-react";
import type { FaqEntry } from "@/lib/faq";

interface FaqItemProps {
  faq: FaqEntry;
  open: boolean;
  onToggle: (id: string) => void;
}

export function FaqItem({ faq, open, onToggle }: FaqItemProps) {
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(faq.id)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-[13px] font-medium leading-snug text-[var(--ink)]">
          {faq.question}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          {open ? <X size={16} /> : <Plus size={16} />}
        </span>
      </button>
      {open && (
        <p className="pb-3 pr-6 text-[13px] leading-relaxed text-[var(--muted)]">
          {faq.answer}
        </p>
      )}
    </div>
  );
}

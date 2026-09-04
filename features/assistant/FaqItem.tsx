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
  /** 3 closely-related suggested FAQs rendered below the answer when open. */
  related?: FaqEntry[];
  onRelatedToggle?: (id: string) => void;
}

/**
 * Accordion row for the FAQ fast-path (§11.3 step 2). When open, the verbatim
 * answer is followed by up to 3 closely-related suggested FAQs as chips.
 */
export function FaqItem({
  faq,
  open,
  onToggle,
  related,
  onRelatedToggle,
}: FaqItemProps) {
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(faq.id)}
        className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
      >
        <span className="text-[13px] font-semibold text-[var(--ink)]">
          {faq.question}
        </span>
        {open ? (
          <X size={14} aria-hidden className="shrink-0 text-[var(--muted)]" />
        ) : (
          <Plus size={14} aria-hidden className="shrink-0 text-[var(--muted)]" />
        )}
      </button>
      {open && (
        <div className="pb-3 pr-6">
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">
            {faq.answer}
          </p>
          {related && related.length > 0 && (
            <div className="mt-3">
              <p className="eyebrow mb-1.5">Suggested</p>
              <div className="flex flex-col gap-1.5">
                {related.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onRelatedToggle?.(r.id)}
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-left text-[12px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--magenta)]"
                  >
                    {r.question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

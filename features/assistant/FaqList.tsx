"use client";

import type { FaqEntry } from "@/lib/faq";
import { FaqItem } from "./FaqItem";

interface FaqListProps {
  faqs: FaqEntry[];
  openId: string | null;
  onToggle: (id: string) => void;
  /** 3 closely-related suggested FAQs for the currently open entry. */
  relatedFaqs?: FaqEntry[];
}

/**
 * FAQ fast-path list (§11.3 step 2). Shows at most 4 entries under a single
 * "FAQs" header — the full 13-item deck was overwhelming. When the user opens
 * one, FaqItem renders 3 closely-related suggested FAQs below the answer.
 */
export function FaqList({ faqs, openId, onToggle, relatedFaqs }: FaqListProps) {
  // Chip navigation fix: a suggested FAQ opened via a chip may live outside the
  // top-4 slice. Include the open entry in the visible list so it renders
  // expanded (with its own Suggested chips) instead of silently closing.
  const topFour = faqs.slice(0, 4);
  const openEntry = openId ? faqs.find((f) => f.id === openId) : undefined;
  const visible =
    openEntry && !topFour.some((f) => f.id === openEntry.id)
      ? [...topFour, openEntry]
      : topFour;

  return (
    <div>
      <p className="eyebrow mb-1">FAQs</p>
      {visible.map((faq) => (
        <FaqItem
          key={faq.id}
          faq={faq}
          open={openId === faq.id}
          onToggle={onToggle}
          related={openId === faq.id ? relatedFaqs : undefined}
          onRelatedToggle={onToggle}
        />
      ))}
    </div>
  );
}

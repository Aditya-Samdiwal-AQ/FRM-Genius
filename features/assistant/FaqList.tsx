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
  return (
    <div>
      <p className="eyebrow mb-1">FAQs</p>
      {faqs.slice(0, 4).map((faq) => (
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

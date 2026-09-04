"use client";

// FRM Assistant — FAQ mode body (Plan.md §11.2 #4).
// SUGGESTED eyebrow + one FaqItem per entry, grouped under its category label.
// The list is long enough to scroll — later FAQs are reachable by scrolling.

import type { FaqEntry } from "@/lib/faq";
import { FaqItem } from "./FaqItem";

interface FaqListProps {
  faqs: FaqEntry[];
  openId: string | null;
  onToggle: (id: string) => void;
}

export function FaqList({ faqs, openId, onToggle }: FaqListProps) {
  const categories: string[] = [];
  for (const faq of faqs) {
    if (!categories.includes(faq.category)) categories.push(faq.category);
  }

  return (
    <div>
      <p className="eyebrow mb-1">Suggested</p>
      {categories.map((category) => (
        <section key={category}>
          <p className="provenance mt-3 mb-1 uppercase">{category}</p>
          {faqs
            .filter((faq) => faq.category === category)
            .map((faq) => (
              <FaqItem key={faq.id} faq={faq} open={openId === faq.id} onToggle={onToggle} />
            ))}
        </section>
      ))}
    </div>
  );
}

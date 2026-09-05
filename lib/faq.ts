// FRM Assistant — FAQ knowledge base + local keyword matcher (Plan.md §11.1, §11.5).
// Search-first pipeline: the agent is only called when this matcher returns null.

import faqData from "@/data/faq.json";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
}

interface RawFaq {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  url: string;
  status: string;
  locale: string;
}

/** Published FAQs only, in list order (deterministic — §WU8 determinism rule). */
export function loadFaqs(): FaqEntry[] {
  const raw = (faqData as { faqs: RawFaq[] }).faqs;
  return raw
    .filter((f) => f.status === "published")
    .map(({ id, question, answer, keywords, category }) => ({
      id,
      question,
      answer,
      keywords,
      category,
    }));
}

/** Trim, lowercase, collapse whitespace — §11.5 step 1. */
export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function wordBoundaryHit(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "do", "does",
  "did", "can", "could", "should", "would", "will", "shall", "may", "might",
  "i", "me", "my", "we", "our", "you", "your", "it", "its", "this", "that",
  "these", "those", "of", "for", "to", "in", "on", "at", "by", "with", "from",
  "and", "or", "but", "if", "then", "than", "so", "as", "about", "into",
  "what", "which", "who", "whom", "how", "why", "when", "where", "am",
]);

/** Content words of a question — used for question-overlap scoring. */
function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export interface FaqMatch {
  entry: FaqEntry;
  score: number;
}

/**
 * Deterministic score for one entry against a normalized question:
 * keyword phrase hits (word-boundary) + shared content words with the entry's
 * own question. The overlap term guarantees every FAQ's verbatim question
 * scores highest against itself (self-match property, §WU13).
 */
function scoreFaq(q: string, entry: FaqEntry): number {
  let score = 0;
  for (const keyword of entry.keywords) {
    if (wordBoundaryHit(q, normalize(keyword))) score += 1;
  }
  const qTokens = new Set(tokenize(q));
  for (const token of tokenize(entry.question)) {
    if (qTokens.has(token)) score += 1;
  }
  return score;
}

/**
 * Keyword matcher — §11.5 step 2. Highest score wins; ties broken by more
 * keywords, then list order. A match needs at least MIN_MATCH_POINTS (2):
 * every published FAQ's verbatim question self-scores ≥ 4, so real FAQ
 * questions always clear the bar, while a single generic keyword (e.g.
 * "plan") can no longer hijack an unrelated question — those escalate to
 * the agent, which answers from live data or admits it doesn't know.
 */
const MIN_MATCH_POINTS = 2;

export function matchFaq(text: string, faqs: FaqEntry[] = loadFaqs()): FaqMatch | null {
  const q = normalize(text);
  if (q.length === 0) return null;

  let best: FaqMatch | null = null;
  for (const entry of faqs) {
    const score = scoreFaq(q, entry);
    if (score < MIN_MATCH_POINTS) continue;
    if (
      best === null ||
      score > best.score ||
      (score === best.score && entry.keywords.length > best.entry.keywords.length)
    ) {
      best = { entry, score };
    }
  }
  return best;
}

/**
 * Suggested chips — §11.3 step 5 / §11.5 step 4: the N highest-scoring FAQ
 * entries for the transcript context, excluding ids the user already asked
 * about. Deterministic ordering (score desc, then list order).
 */
export function suggestFaqs(
  context: string,
  excludeIds: string[],
  limit = 3,
  faqs: FaqEntry[] = loadFaqs(),
): FaqEntry[] {
  const q = normalize(context);
  const scored = faqs
    .filter((f) => !excludeIds.includes(f.id))
    .map((entry) => ({ entry, score: scoreFaq(q, entry) }))
    .filter((m) => m.score >= 1)
    .sort((a, b) => b.score - a.score);

  // Fall back to list order (still deterministic) when context matches nothing.
  if (scored.length === 0) {
    return faqs.filter((f) => !excludeIds.includes(f.id)).slice(0, limit);
  }
  return scored.slice(0, limit).map((m) => m.entry);
}

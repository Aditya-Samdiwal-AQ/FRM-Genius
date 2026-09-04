// FRM Assistant — swappable AI-agent API surface (Plan.md §11.1, §11.9).
// The agent endpoint (/api/assistant) answers free-text questions from the
// live FRM database in real time: open/resolved conflicts, affected
// accounts, provenance, corrected paths, notifications, audit trails, and
// compliance-reviewed materials. The FAQ fast-path in lib/faq.ts is
// unchanged — only this agent call was swapped in one commit.

import { ASSISTANT_API_KEY, ASSISTANT_ENDPOINT } from "@/lib/assistantConfig";

export interface AgentAnswer {
  ok: boolean;
  answer?: string;
  error?: string;
  source: "agent" | "mock";
}

const UNREACHABLE_ERROR =
  "The assistant can't reach its knowledge base right now. Please try again in a moment.";

/**
 * Ask the AI agent a free-text question. Never throws across the UI boundary —
 * failures come back as { ok: false, error } and the panel renders a Retry chip.
 */
export async function askAgent(question: string): Promise<AgentAnswer> {
  try {
    const res = await fetch(ASSISTANT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ASSISTANT_API_KEY}`,
      },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) return { ok: false, error: UNREACHABLE_ERROR, source: "agent" };
    const data = (await res.json()) as { answer?: string };
    if (!data.answer) return { ok: false, error: UNREACHABLE_ERROR, source: "agent" };
    return { ok: true, answer: data.answer, source: "agent" };
  } catch {
    return { ok: false, error: UNREACHABLE_ERROR, source: "agent" };
  }
}

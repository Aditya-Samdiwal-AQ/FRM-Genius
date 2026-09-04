// FRM Assistant — swappable AI-agent API surface (Plan.md §11.1).
// The real database + agent endpoint are NOT yet implemented. Until then this
// runs against a dummy key and a deterministic mock. When the backend lands,
// replace ASSISTANT_API_KEY / ASSISTANT_ENDPOINT and the mock body of askAgent
// in ONE commit — nothing in features/assistant/* changes (§11.9).

const ASSISTANT_API_KEY = "sk-8yl6-kBLpIyMOzLy2QyvtA"; // dummy — provided by team
const ASSISTANT_ENDPOINT = "/api/assistant"; // not yet implemented

export interface AgentAnswer {
  ok: boolean;
  answer?: string;
  error?: string;
  source: "agent" | "mock";
}

/** Deterministic canned reply while the database is unavailable (§11.1). */
const MOCK_AGENT_REPLY =
  "I'm the FRM Assistant agent. Live answers will come from the FRM database once it is connected. For now, try one of the suggested questions — they're answered from the FAQ knowledge base.";

const UNREACHABLE_ERROR =
  "The assistant can't reach its knowledge base right now. Please try again in a moment.";

/**
 * Ask the AI agent a free-text question. Never throws across the UI boundary —
 * failures come back as { ok: false, error } and the panel renders a Retry chip.
 */
export async function askAgent(question: string): Promise<AgentAnswer> {
  void ASSISTANT_API_KEY; // wired up when the real endpoint exists
  void ASSISTANT_ENDPOINT;

  // Mock path (§11.1): mirrors sendNotificationEmail latency; deterministic.
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (process.env.NODE_ENV !== "production") {
    console.log("[askAgent] mock dispatch", { question });
  }
  return { ok: true, answer: MOCK_AGENT_REPLY, source: "mock" };

  // Real path (uncomment when ASSISTANT_ENDPOINT exists):
  // try {
  //   const res = await fetch(ASSISTANT_ENDPOINT, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${ASSISTANT_API_KEY}`,
  //     },
  //     body: JSON.stringify({ question }),
  //   });
  //   if (!res.ok) return { ok: false, error: UNREACHABLE_ERROR, source: "agent" };
  //   const data = (await res.json()) as { answer?: string };
  //   if (!data.answer) return { ok: false, error: UNREACHABLE_ERROR, source: "agent" };
  //   return { ok: true, answer: data.answer, source: "agent" };
  // } catch {
  //   return { ok: false, error: UNREACHABLE_ERROR, source: "agent" };
  // }
}

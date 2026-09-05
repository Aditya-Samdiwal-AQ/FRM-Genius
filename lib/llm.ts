/**
 * Minimal LLM client for the FRM agentic assistant.
 *
 * Talks to the internal LLM gateway (OpenAI-compatible /v1/chat/completions)
 * with plain fetch — no SDKs. Sampling config is LOCKED from validation:
 * temperature 0.7 + chat_template_kwargs.enable_thinking=false + min_p 0.05
 * is the only combination that returns clean content without reasoning echo.
 */

/**
 * Zscaler MITM-proxies outbound TLS on this network; Node's fetch rejects the
 * re-signed certificate unless verification is disabled. curl works without
 * this because it uses the system trust store. Must be set before any fetch.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const LLM_ENDPOINT = "https://llmhub-stg.precisionai.tools/v1/chat/completions";
const LLM_API_KEY = "sk-8yl6-kBLpIyMOzLy2QyvtA";
const LLM_MODEL = "Developer";

/** Typical grounded answers take 1.5–18 s; 60 s covers outliers. */
const LLM_TIMEOUT_MS = 60_000;

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOptions {
  maxTokens?: number;
  timeoutMs?: number;
}

export class LlmError extends Error {}

/** One chat completion. Returns the assistant message content. */
export async function llmChat(
  messages: LlmMessage[],
  options: LlmOptions = {},
): Promise<string> {
  const { maxTokens = 1200, timeoutMs = LLM_TIMEOUT_MS } = options;

  let response: Response;
  try {
    response = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        chat_template_kwargs: { enable_thinking: false },
        min_p: 0.05,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new LlmError(`LLM gateway unreachable: ${reason}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new LlmError(
      `LLM gateway returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LlmError("LLM gateway returned invalid JSON.");
  }

  const content =
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { choices?: unknown }).choices === "object"
      ? (
          (payload as { choices: Array<{ message?: { content?: unknown } }> })
            .choices?.[0]?.message?.content
        )
      : undefined;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new LlmError("LLM gateway returned an empty completion.");
  }
  return content.trim();
}

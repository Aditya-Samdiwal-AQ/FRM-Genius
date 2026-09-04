"use client";

// FRM Assistant — state machine (Plan.md §11.4) + answer pipeline (§11.5).
// Search first, agent second: a keyword match on the FAQ knowledge base answers
// instantly and verbatim; only unmatched questions escalate to askAgent().

import { useCallback, useMemo, useRef, useState } from "react";
import { loadFaqs, matchFaq, suggestFaqs } from "@/lib/faq";
import { askAgent } from "@/services/assistant";
import type { AssistantMode, ChatMsg, FaqEntry } from "./types";

let nextMsgId = 0;
function makeId(): string {
  nextMsgId += 1;
  return `msg-${nextMsgId}`;
}

export function useAssistant() {
  const [mode, setMode] = useState<AssistantMode>("faq");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAskRef = useRef<string | null>(null);
  const clearedRef = useRef(false);

  const faqs = useMemo(() => loadFaqs(), []);

  /** §11.3 step 2 — accordion toggle; opening one closes the others. */
  const toggleFaq = useCallback(
    (id: string) => {
      setOpenFaqId((current) => (current === id ? null : id));
    },
    [],
  );

  /** §11.5 — resolve an ask through the pipeline and append the reply. */
  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || sending) return; // double-send guard (§11.4)

      lastAskRef.current = trimmed;
      clearedRef.current = false;
      setError(null);
      setMode("chat");
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "user", kind: "faq", text: trimmed },
      ]);

      const match = matchFaq(trimmed, faqs);
      if (match) {
        // 3a — verbatim FAQ answer; the agent is NOT called.
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            kind: "faq",
            text: match.entry.answer,
            faqId: match.entry.id,
          },
        ]);
        return;
      }

      // 3b — no local match: escalate to the agent (mock until backend lands).
      setSending(true);
      try {
        const result = await askAgent(trimmed);
        if (clearedRef.current) return; // Clear() during flight — drop the late reply
        if (result.ok && result.answer) {
          setMessages((prev) => [
            ...prev,
            { id: makeId(), role: "assistant", kind: "agent", text: result.answer as string },
          ]);
        } else {
          setError(result.error ?? "Something went wrong.");
          setMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: "assistant",
              kind: "error",
              text:
                result.error ??
                "The assistant can't reach its knowledge base right now. Please try again in a moment.",
            },
          ]);
        }
      } finally {
        setSending(false);
      }
    },
    [faqs, sending],
  );

  /** §11.4 — the only reset: back to FAQ mode with an empty transcript. */
  const clear = useCallback(() => {
    clearedRef.current = true; // drop any in-flight agent reply
    setMode("faq");
    setMessages([]);
    setOpenFaqId(null);
    setError(null);
    lastAskRef.current = null;
  }, []);

  /** Re-run the last failed ask (§11.2 ChatMessage Retry chip). */
  const retry = useCallback(() => {
    if (lastAskRef.current && !sending) {
      void ask(lastAskRef.current);
    }
  }, [ask, sending]);

  /**
   * Suggested chips (§11.3 step 5): up to 3 highest-ranked FAQ questions for the
   * transcript context, excluding ones already asked. Empty in faq mode.
   */
  const suggestions = useMemo((): FaqEntry[] => {
    if (mode !== "chat") return [];
    const context = messages.map((m) => m.text).join(" ");
    const askedFaqIds = messages
      .filter((m) => m.faqId !== undefined)
      .map((m) => m.faqId as string);
    return suggestFaqs(context, askedFaqIds, 3, faqs);
  }, [mode, messages, faqs]);

  return {
    mode,
    messages,
    openFaqId,
    sending,
    error,
    faqs,
    suggestions,
    toggleFaq,
    ask,
    clear,
    retry,
  };
}

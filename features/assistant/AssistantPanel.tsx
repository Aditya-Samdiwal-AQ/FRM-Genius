"use client";

// FRM Assistant — chat panel shell (Plan.md §11.2 #2/#3).
// 380px card anchored above the launcher; flex column: dark header
// (FRM Assistant · Clear · ✕) / scrollable body / input bar. Closes on ✕,
// Escape, and outside click. Renders nothing while closed.

import { useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { FaqList } from "./FaqList";
import { AssistantInput } from "./AssistantInput";
import { useAssistant } from "./useAssistant";

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const assistant = useAssistant();
  const rootRef = useRef<HTMLDivElement>(null);

  // Escape closes; outside click closes (§11.3 step 6).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const {
    mode,
    messages,
    openFaqId,
    sending,
    faqs,
    suggestions,
    relatedFaqs,
    toggleFaq,
    ask,
    clear,
    retry,
  } = assistant;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="FRM Assistant"
      className="card fixed bottom-40 right-6 z-50 flex max-h-[min(560px,calc(100vh-136px))] w-[380px] flex-col overflow-hidden print:hidden"
    >
      {/* Header — dark bar: sparkle + title · Clear · ✕ (§11.2 #3) */}
      <div className="flex items-center justify-between bg-[var(--nav-bg)] px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <Sparkles size={16} aria-hidden />
          <span className="text-[14px] font-bold">FRM Assistant</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={clear}
            className="text-[13px] text-[var(--muted)] transition-colors hover:text-white"
          >
            Clear
          </button>
          <button
            type="button"
            aria-label="Close FRM Assistant"
            onClick={onClose}
            className="text-[var(--muted)] transition-colors hover:text-white"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>

      {/* Body — scrollable; FAQ list in faq mode, transcript in chat mode */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {mode === "faq" ? (
          <FaqList
            faqs={faqs}
            openId={openFaqId}
            onToggle={toggleFaq}
            relatedFaqs={relatedFaqs}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} onRetry={msg.kind === "error" ? retry : undefined} />
            ))}
            {sending && (
              <div className="flex flex-col items-start gap-1">
                <span className="provenance uppercase">AI-generated</span>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-[var(--page-bg)] px-3.5 py-3">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted)]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted)] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted)] [animation-delay:300ms]" />
                </div>
              </div>
            )}
            {!sending && suggestions.length > 0 && (
              <div className="mt-1">
                <p className="eyebrow mb-1.5">Suggested</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((faq) => (
                    <button
                      key={faq.id}
                      type="button"
                      onClick={() => void ask(faq.question)}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-left text-[12px] leading-snug text-[var(--ink)] hover:border-[var(--magenta)]"
                    >
                      {faq.question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input — pinned bottom bar (§11.2 #7) */}
      <AssistantInput onSend={(text) => void ask(text)} sending={sending} />
    </div>
  );
}

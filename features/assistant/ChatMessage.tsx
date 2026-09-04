"use client";

// FRM Assistant — one message bubble (Plan.md §11.2 #6).
// User: accent-blue bg, white text, right-aligned. Assistant: gray bg, ink text,
// left-aligned. Agent replies carry the mono AI-GENERATED tag. Error replies
// render in a red-tinted bubble with a Retry chip.

import type { ChatMsg } from "./types";

interface ChatMessageProps {
  msg: ChatMsg;
  onRetry?: () => void;
}

export function ChatMessage({ msg, onRetry }: ChatMessageProps) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--accent)] px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--danger)] bg-[var(--danger-bg)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--danger)]">
          {msg.text}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12px] font-semibold text-[var(--ink)] hover:border-[var(--muted)]"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {msg.kind === "agent" && <span className="provenance uppercase">AI-generated</span>}
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[var(--page-bg)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--ink)]">
        {msg.text}
      </div>
    </div>
  );
}

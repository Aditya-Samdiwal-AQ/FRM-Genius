"use client";

// FRM Assistant — bottom ask bar (Plan.md §11.2 #7).
// The ONLY free-text input in the app (hard-checklist amendment, Plan.md §3).
// Enter sends; Shift+Enter inserts a newline. Disabled while sending or empty.

import { useState } from "react";
import { Send } from "lucide-react";

interface AssistantInputProps {
  onSend: (text: string) => void;
  sending: boolean;
}

export function AssistantInput({ onSend, sending }: AssistantInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || sending) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <input
        type="text"
        value={value}
        placeholder="Ask a question…"
        disabled={sending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--page-bg)] px-3.5 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--magenta)] disabled:opacity-60"
      />
      <button
        type="button"
        aria-label="Send question"
        onClick={submit}
        disabled={sending || value.trim().length === 0}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--magenta)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {sending ? (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
          />
        ) : (
          <Send size={16} aria-hidden />
        )}
      </button>
    </div>
  );
}

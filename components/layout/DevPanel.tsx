"use client";

import { useConflictDispatch } from "@/store/ConflictStore";
import { RotateCcw, Zap } from "lucide-react";

export function DevPanel() {
  const dispatch = useConflictDispatch();
  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg print:hidden">
      <span className="eyebrow">Demo controls</span>
      <button
        type="button"
        onClick={() => dispatch({ type: "RESET_DEMO" })}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--page-bg)]"
      >
        <RotateCcw size={13} aria-hidden />
        Reset demo
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: "SIMULATE_MMIT_UPDATE" })}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--page-bg)]"
      >
        <Zap size={13} aria-hidden />
        Simulate MMIT update
      </button>
    </div>
  );
}

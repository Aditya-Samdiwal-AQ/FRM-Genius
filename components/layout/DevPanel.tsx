"use client";

// Demo controls — pre-pull UI, restored (bottom-left panel).
// Reset demo restores every store from seeds/ and re-runs the diff engine;
// Simulate MMIT update re-runs the snapshot diff (detection is idempotent).

import { useConflictActions } from "@/store/ConflictStore";
import { RotateCcw, Zap } from "lucide-react";

export function DevPanel() {
  const { resetDemo, simulateMmitUpdate } = useConflictActions();
  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg print:hidden">
      <span className="eyebrow">Demo controls</span>
      <button
        type="button"
        onClick={() => void resetDemo()}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--page-bg)]"
      >
        <RotateCcw size={13} aria-hidden />
        Reset demo
      </button>
      <button
        type="button"
        onClick={() => void simulateMmitUpdate()}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--page-bg)]"
      >
        <Zap size={13} aria-hidden />
        Simulate MMIT update
      </button>
    </div>
  );
}

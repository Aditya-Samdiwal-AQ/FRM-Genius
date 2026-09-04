// Priority scoring — Plan.md §5.5.
// Two factors only: plan lives and affected-account count, equally weighted,
// each normalized against a cap, expressed as a single 0–100 score.
// Computed at read time (GET /api/payer-changes); nothing is persisted.

import type { ChangePriority } from "@/lib/types";

/** Normalization cap for plan lives (~largest plan in the dataset). */
export const LIVES_CAP = 3_000_000;

/** Saturation point for affected-account count. */
export const ACCOUNTS_CAP = 5;

export function computePriority(
  lives: number,
  accounts: number,
): ChangePriority {
  const livesScore = Math.min(lives / LIVES_CAP, 1);
  const accountsScore = Math.min(accounts / ACCOUNTS_CAP, 1);
  return {
    score: Math.round(100 * (0.5 * livesScore + 0.5 * accountsScore)),
    lives,
    accounts,
  };
}

/** Minimal shape needed to sort changes by priority deterministically. */
export interface PrioritySortable {
  priority: ChangePriority;
  detected_at: string;
  id: string;
}

/** Descending: score → lives → accounts → detected_at → id (stable ties). */
export function comparePriorityDesc(
  a: PrioritySortable,
  b: PrioritySortable,
): number {
  return (
    b.priority.score - a.priority.score ||
    b.priority.lives - a.priority.lives ||
    b.priority.accounts - a.priority.accounts ||
    b.detected_at.localeCompare(a.detected_at) ||
    a.id.localeCompare(b.id)
  );
}

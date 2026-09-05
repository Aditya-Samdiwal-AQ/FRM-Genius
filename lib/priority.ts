// Priority scoring — lives-based.
// Single factor: plan lives, normalized against a cap, expressed as a
// 0–100 score. Computed at read time (GET /api/payer-changes, assistant
// composer, Home dashboard); nothing is persisted.

import type { ChangePriority } from "@/lib/types";

/** Normalization cap for plan lives (~largest plan in the dataset). */
export const LIVES_CAP = 3_000_000;

export function computePriority(
  lives: number,
  accounts: number,
): ChangePriority {
  const livesScore = Math.min(lives / LIVES_CAP, 1);
  return {
    score: Math.round(100 * livesScore),
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

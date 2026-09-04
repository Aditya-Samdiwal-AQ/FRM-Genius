// Swappable API surface over the store — Plan.md §2.1.
// The backend teammate replaces these implementations later without touching UI code.

import type { Conflict, Material } from "@/data/synthetic";

export interface EmailPayload {
  recipients: string[];
  subject: string;
  messageHtml: string;
  materials: Material[];
  conflict: Conflict;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export function getConflicts(): Conflict[] {
  // Mock: the store is the source of truth on the client.
  return [];
}

export function resolveConflict(
  conflictId: string,
  accountIds: string[],
  materialIds: string[],
  message: string,
): void {
  // Mock: dispatch happens in the UI via ConflictStore.
  void conflictId;
  void accountIds;
  void materialIds;
  void message;
}

export function notifyAccounts(conflictId: string, accountIds: string[]): void {
  void conflictId;
  void accountIds;
}

/**
 * Real email-dispatch call. On `Confirm & send` the frontend invokes this and
 * the backend teammate's endpoint sends the email to the recipients. Until that
 * endpoint is ready, resolves against a local mock (simulated latency, no network).
 */
export async function sendNotificationEmail(
  payload: EmailPayload,
): Promise<SendEmailResult> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (process.env.NODE_ENV !== "production") {
    console.log("[sendNotificationEmail] mock dispatch", {
      to: payload.recipients,
      subject: payload.subject,
      materials: payload.materials.map((m) => m.title),
      conflict: payload.conflict.id,
    });
  }
  return { ok: true };
}

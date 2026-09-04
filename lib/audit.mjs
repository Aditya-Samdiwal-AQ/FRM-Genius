/**
 * Audit-trail helpers — Plan.md §5.4, §7.
 *
 * Plain ESM (.mjs). Appends events to `auditEvents.json` serialized behind
 * the DB write mutex.
 */

import { mutateStore, nextId } from "./db.mjs";

/**
 * Build one audit event. `at` defaults to now (ISO string).
 */
export function makeAuditEvent({ payer_change_id, actor, event_type, description, at }) {
  return {
    id: nextId("aud"),
    payer_change_id,
    actor,
    event_type,
    description,
    at: at ?? new Date().toISOString(),
  };
}

/**
 * Append events to auditEvents.json under the write lock. Returns the
 * created events (with ids/timestamps filled in).
 */
export async function appendAuditEvents(events) {
  const created = events.map(makeAuditEvent);
  await mutateStore("auditEvents.json", (current) => [...current, ...created]);
  return created;
}

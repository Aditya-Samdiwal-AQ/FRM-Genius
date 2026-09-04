import { NextRequest } from "next/server";
import { db } from "@/lib/db.mjs";
import type { Account, AuditEvent, Material, Notification, PayerChange } from "@/lib/types";

/**
 * GET /api/payer-changes/:id/audit — Plan.md §7.
 * Full audit trail + resolution summary + notification record.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const change = (db.payerChanges() as PayerChange[]).find((c) => c.id === id);
  if (!change) {
    return Response.json({ error: `Payer change ${id} not found.` }, { status: 404 });
  }

  const events = (db.auditEvents() as AuditEvent[])
    .filter((e) => e.payer_change_id === id)
    .sort((a, b) => a.at.localeCompare(b.at));

  // Truth rule: the LATEST notification for this change is the record of what
  // was actually communicated (a re-send replaces the earlier one).
  const notifications = (db.notifications() as Notification[])
    .filter((n) => n.payer_change_id === id)
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  const notification = notifications.at(-1) ?? null;

  const materials = (db.materials() as Material[]).filter((m) =>
    notification?.message.materials.includes(m.title),
  );
  const accountsById = new Map(
    (db.accounts() as Account[]).map((a) => [a.id, a]),
  );

  return Response.json({
    change,
    audit_events: events,
    notification,
    resolution_summary: {
      status: change.status,
      resolved_at: change.resolved_at ?? null,
      resolved_by: change.resolved_by ?? null,
      corrected_path_source: change.corrected_path_source ?? null,
      corrected_path_value: change.corrected_path_value ?? null,
      accounts_notified: (notification?.recipient_account_ids ?? []).map(
        (accountId) => ({
          id: accountId,
          name: accountsById.get(accountId)?.name ?? accountId,
        }),
      ),
      materials_sent: materials.map((m) => ({ id: m.id, title: m.title })),
    },
  });
}

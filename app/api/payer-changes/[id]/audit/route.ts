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

  const notification =
    (db.notifications() as Notification[]).find((n) => n.payer_change_id === id) ?? null;

  const accounts = (db.accounts() as Account[]).filter((a) =>
    change.affected_account_ids.includes(a.id),
  );
  const materials = (db.materials() as Material[]).filter((m) =>
    notification?.message.materials.includes(m.title),
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
      accounts_notified: notification?.recipient_account_ids ?? [],
      materials_sent: materials.map((m) => ({ id: m.id, title: m.title })),
    },
  });
}

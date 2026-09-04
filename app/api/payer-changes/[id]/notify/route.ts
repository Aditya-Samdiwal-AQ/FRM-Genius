import { NextRequest } from "next/server";
import { db } from "@/lib/db.mjs";
import { notifyBodySchema } from "@/lib/schemas";
import { sendChangeNotification } from "@/lib/notify.mjs";
import type { PayerChange } from "@/lib/types";

/**
 * POST /api/payer-changes/:id/notify — Plan.md §7.
 * Body: { material_ids: string[] }.
 * Sends the templated email to every affected account's email via
 * Nodemailer (SMTP) or the mock transport (.eml in data/outbox/).
 * Persists a Notification record + audit events.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = notifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { material_ids } = parsed.data;

  const change = (db.payerChanges() as PayerChange[]).find((c) => c.id === id);
  if (!change) {
    return Response.json({ error: `Payer change ${id} not found.` }, { status: 404 });
  }
  if (change.affected_account_ids.length === 0) {
    return Response.json(
      { error: "No affected accounts to notify for this change." },
      { status: 409 },
    );
  }

  try {
    const notification = await sendChangeNotification({
      change,
      accountIds: change.affected_account_ids,
      materialIds: material_ids,
    });
    return Response.json({ ok: true, notification });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Email dispatch failed.",
      },
      { status: 502 },
    );
  }
}

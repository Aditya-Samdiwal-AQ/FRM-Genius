import { NextRequest } from "next/server";
import { db, mutateStore } from "@/lib/db.mjs";
import { appendAuditEvents } from "@/lib/audit.mjs";
import { resolveBodySchema } from "@/lib/schemas";
import { FIELD_LABEL } from "@/lib/constants.mjs";
import type { PayerChange } from "@/lib/types";

/**
 * POST /api/payer-changes/:id/resolve — Plan.md §7.
 * Body: { corrected_path_source: "MMIT"|"Formulary"|"Internal", corrected_path_value }.
 * Sets status=resolved, appends audit events, does NOT send email.
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

  const parsed = resolveBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { corrected_path_source, corrected_path_value } = parsed.data;

  let notFound = false;
  let alreadyResolved = false;

  await mutateStore("payerChanges.json", (current: unknown) => {
    const changes = current as PayerChange[];
    const idx = changes.findIndex((c) => c.id === id);
    if (idx === -1) {
      notFound = true;
      return current;
    }
    if (changes[idx].status === "resolved") {
      alreadyResolved = true; // idempotent — no state change, no audit spam
      return current;
    }
    const next = [...changes];
    next[idx] = {
      ...changes[idx],
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: "Jordan Lee",
      corrected_path_source,
      corrected_path_value,
    };
    return next;
  });

  if (notFound) {
    return Response.json({ error: `Payer change ${id} not found.` }, { status: 404 });
  }

  const change = (db.payerChanges() as PayerChange[]).find((c) => c.id === id)!;
  const fieldLabel = FIELD_LABEL[change.field] ?? change.field;

  if (!alreadyResolved) {
    await appendAuditEvents([
      {
        payer_change_id: id,
        actor: "Jordan Lee",
        event_type: "corrected_path_selected",
        description: `Corrected path selected for ${fieldLabel}: "${corrected_path_value}" (source: ${corrected_path_source})`,
      },
      {
        payer_change_id: id,
        actor: "Jordan Lee",
        event_type: "accounts_resolved",
        description: `${change.affected_account_ids.length} account${change.affected_account_ids.length === 1 ? "" : "s"} resolved at territory level`,
      },
    ]);
  }

  return Response.json({ change });
}

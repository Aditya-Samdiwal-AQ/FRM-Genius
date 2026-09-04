import { NextRequest } from "next/server";
import { db } from "@/lib/db.mjs";
import type { Account, Material, PayerChange } from "@/lib/types";

/**
 * GET /api/payer-changes/:id — Plan.md §7.
 * Detail: previous/authoritative provenance, affected accounts
 * (id, name, email, plan), and suggested materials for the change type.
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

  const accounts = (db.accounts() as Account[]).filter((a) =>
    change.affected_account_ids.includes(a.id),
  );
  const suggestedMaterials = (db.materials() as Material[]).filter((m) =>
    m.applicable_change_types.includes(change.change_type),
  );

  return Response.json({
    change,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      plan_id: a.primary_plan_id,
      plan_name: a.primary_plan_name,
      payer_name: a.payer_name,
      channel: a.channel,
      territory: a.territory,
    })),
    suggested_materials: suggestedMaterials,
  });
}

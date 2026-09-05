import { db } from "@/lib/db.mjs";
import type { Account } from "@/lib/types";

/**
 * GET /api/accounts — Plan.md §7.
 * Read-only account list (id, name, plan, payer, channel, email).
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = db.accounts() as Account[];
  return Response.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      territory: a.territory,
      hcp_specialty: a.hcp_specialty,
      primary_plan_id: a.primary_plan_id,
      primary_plan_name: a.primary_plan_name,
      payer_name: a.payer_name,
      channel: a.channel,
      email: a.email,
    })),
    total: accounts.length,
  });
}

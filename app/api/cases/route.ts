import { db, nextId } from "@/lib/db.mjs";
import { FIELD_LABEL } from "@/lib/constants.mjs";
import type { Account, ChangeType } from "@/lib/types";

/**
 * POST /api/cases — log an inbound account call as a new "Open Cases" row.
 *
 * The FRM supplies account, payer, plan, and issue (a tracked change type).
 * Status is a UI-only field and is not sent. The backend locates the matching
 * snapshot row — med-policy first (plan_id + product), falling back to the
 * formulary (formulary_id suffix ↔ plan_id suffix join, Plan.md §6) — and
 * returns that row's `as_of_date`. The client computes Days Open as the
 * difference between today and the as-of date.
 *
 * Nothing is persisted: this is a read-time lookup for the demo.
 */

export const dynamic = "force-dynamic";

const PRODUCT = db.product() as { id: string; name: string; hcpcs: string; ndc: string; csv_name: string };

interface CaseRequestBody {
  account_id?: unknown;
  payer_name?: unknown;
  plan_id?: unknown;
  issue?: unknown;
}

function planSuffix(id: string) {
  return id.slice(-3);
}

export async function POST(request: Request) {
  let body: CaseRequestBody;
  try {
    body = (await request.json()) as CaseRequestBody;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const accountId = typeof body.account_id === "string" ? body.account_id : "";
  const payerName = typeof body.payer_name === "string" ? body.payer_name.trim() : "";
  const planId = typeof body.plan_id === "string" ? body.plan_id : "";
  const issue = typeof body.issue === "string" ? body.issue : "";

  if (!accountId || !payerName || !planId || !issue) {
    return Response.json(
      { error: "account_id, payer_name, plan_id and issue are required." },
      { status: 400 },
    );
  }

  const account = (db.accounts() as Account[]).find((a) => a.id === accountId);
  if (!account) {
    return Response.json({ error: `Unknown account ${accountId}.` }, { status: 404 });
  }

  // The issue must be one of the 8 tracked change types.
  if (!Object.hasOwn(FIELD_LABEL, issue)) {
    return Response.json({ error: `Unknown issue type "${issue}".` }, { status: 400 });
  }

  // Guard: the account's primary plan should agree with the supplied payer/plan.
  if (account.primary_plan_id !== planId || account.payer_name !== payerName) {
    return Response.json(
      { error: "Account, payer and plan do not match a known combination." },
      { status: 422 },
    );
  }

  const asOfDate = findAsOfDate(planId, issue as ChangeType);
  if (!asOfDate) {
    return Response.json(
      { error: "No snapshot row found for this plan/issue combination." },
      { status: 404 },
    );
  }

  return Response.json({
    case: {
      id: nextId("case"),
      account_id: account.id,
      account_name: account.name,
      territory: account.territory,
      hcp_specialty: account.hcp_specialty,
      payer_name: payerName,
      plan_id: planId,
      plan_name: account.primary_plan_name,
      channel: account.channel,
      issue,
      issue_label: FIELD_LABEL[issue as ChangeType],
      as_of_date: asOfDate,
      logged_at: new Date().toISOString(),
    },
  });
}

// ---------------------------------------------------------------------------
// Snapshot lookup — med-policy first, formulary fallback (§6 join).
// ---------------------------------------------------------------------------

/** Med-policy fields resolve against medPolicySnapshots; formulary fields
 *  (formulary_status, restriction, tier) resolve against formularySnapshots. */
const FORMULARY_ISSUES = new Set(["formulary_status", "restriction", "tier"]);

function findAsOfDate(planId: string, issue: ChangeType): string | null {
  if (FORMULARY_ISSUES.has(issue)) {
    const rows = db.formularySnapshots() as Array<{
      formulary_id: string;
      product_name: string;
      as_of_date: string;
    }>;
    const match = rows
      .filter((r) => planSuffix(r.formulary_id) === planSuffix(planId) && r.product_name === PRODUCT.csv_name)
      .sort((a, b) => b.as_of_date.localeCompare(a.as_of_date))[0];
    return match ? match.as_of_date : null;
  }

  const rows = db.medPolicySnapshots() as Array<{
    plan_id: string;
    product_name: string;
    as_of_date: string;
  }>;
  const match = rows
    .filter((r) => r.plan_id === planId && r.product_name === PRODUCT.csv_name)
    .sort((a, b) => b.as_of_date.localeCompare(a.as_of_date))[0];
  return match ? match.as_of_date : null;
}

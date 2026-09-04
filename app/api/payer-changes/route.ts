import { NextRequest } from "next/server";
import { db } from "@/lib/db.mjs";
import { GROUP_ORDER } from "@/lib/types";
import type { ChangeTypeGroup, PayerChange } from "@/lib/types";

/**
 * GET /api/payer-changes — Plan.md §7.
 * Query params: status=open|resolved|all (default "open").
 * Returns changes grouped by change_type_group in canonical order.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? "open";
  if (!["open", "resolved", "all"].includes(status)) {
    return Response.json(
      { error: "Invalid status. Expected open | resolved | all." },
      { status: 400 },
    );
  }

  const all = db.payerChanges() as PayerChange[];
  const filtered =
    status === "all" ? all : all.filter((c) => c.status === status);

  const groups = new Map<ChangeTypeGroup, PayerChange[]>();
  for (const change of filtered) {
    const list = groups.get(change.change_type_group) ?? [];
    list.push(change);
    groups.set(change.change_type_group, list);
  }

  const grouped = GROUP_ORDER.filter((g) => groups.has(g)).map((group) => ({
    group,
    changes: groups.get(group) ?? [],
  }));

  return Response.json({
    status,
    total: filtered.length,
    open_count: all.filter((c) => c.status === "open").length,
    resolved_count: all.filter((c) => c.status === "resolved").length,
    groups: grouped,
  });
}

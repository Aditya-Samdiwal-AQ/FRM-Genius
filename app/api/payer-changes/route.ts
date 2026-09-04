import { NextRequest } from "next/server";
import { db } from "@/lib/db.mjs";
import { comparePriorityDesc, computePriority } from "@/lib/priority";
import { GROUP_ORDER } from "@/lib/types";
import type {
  ChangePriority,
  ChangeTypeGroup,
  PayerChange,
  Plan,
} from "@/lib/types";

/** List-shape change with read-time priority attached (Plan.md §5.5). */
type RankedChange = PayerChange & { priority: ChangePriority };

/**
 * GET /api/payer-changes — Plan.md §7.
 * Query params: status=open|resolved|all (default "open").
 * Returns changes grouped by change_type_group in canonical order, each
 * enriched with read-time priority (§5.5) and sorted by priority within
 * its group.
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

  // Read-time priority (Plan.md §5.5): plan lives (plans.json) + affected
  // account count, equal weight, 0–100. Sorting the full set before grouping
  // yields priority-ordered rows inside every group.
  const plans = db.plans() as Plan[];
  const livesByPlan = new Map<string, number>(
    plans.map((p) => [p.id, Number(p.lives) || 0]),
  );
  const ranked: RankedChange[] = filtered
    .map((change) => {
      const lives = livesByPlan.get(change.plan_id) ?? 0;
      return {
        ...change,
        priority: computePriority(lives, change.affected_account_ids.length),
      };
    })
    .sort(comparePriorityDesc);

  const groups = new Map<ChangeTypeGroup, RankedChange[]>();
  for (const change of ranked) {
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

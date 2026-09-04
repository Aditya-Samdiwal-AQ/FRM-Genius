import { resetFromSeeds } from "@/lib/db.mjs";
import { runDiff } from "@/lib/diff.mjs";

/**
 * POST /api/dev/reset — Plan.md §7.
 * Reload snapshots + reference tables from seeds/, re-run the diff engine,
 * clear notifications/auditEvents/outbox.
 */

export const dynamic = "force-dynamic";

export async function POST() {
  await resetFromSeeds();
  const { changes } = runDiff();
  const open = changes.filter((c) => c.status === "open");
  return Response.json({
    ok: true,
    total_changes: changes.length,
    open_changes: open.length,
    resolved_changes: changes.length - open.length,
  });
}

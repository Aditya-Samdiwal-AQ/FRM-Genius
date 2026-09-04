import { runDiff } from "@/lib/diff.mjs";

/**
 * POST /api/dev/diff — re-run the snapshot diff engine (MMIT update
 * detection). Idempotent: only detections not already represented in
 * payerChanges.json create new rows; resolution state is preserved.
 */

export const dynamic = "force-dynamic";

export async function POST() {
  const { changes } = runDiff();
  const open = changes.filter((c) => c.status === "open");
  return Response.json({
    ok: true,
    total_changes: changes.length,
    open_changes: open.length,
    resolved_changes: changes.length - open.length,
  });
}

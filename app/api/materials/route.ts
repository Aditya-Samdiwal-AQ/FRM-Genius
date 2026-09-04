import { NextRequest } from "next/server";
import { db } from "@/lib/db.mjs";
import type { Material } from "@/lib/types";

/**
 * GET /api/materials — Plan.md §7.
 * Query param: change_type (optional) — filter by applicable change type.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const changeType = request.nextUrl.searchParams.get("change_type");
  const materials = db.materials() as Material[];

  const filtered =
    changeType && changeType !== "all"
      ? materials.filter((m) => m.applicable_change_types.includes(changeType as never))
      : materials;

  return Response.json({ materials: filtered, total: filtered.length });
}

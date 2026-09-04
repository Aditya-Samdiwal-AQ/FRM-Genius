"use client";

// Resolved summaries table — one row per resolved plan conflict.
// Enriches each row with the audit endpoint's resolution_summary
// (accounts notified + materials sent); falls back to the PayerChange
// record while those load.

import { useEffect, useState } from "react";
import type { PayerChange } from "@/lib/types";
import { formatDate, formatTimestamp } from "@/lib/format";
import { FRM_NAME } from "@/data/synthetic";
import { getPayerChangeAudit, type ResolutionSummary } from "@/services/api";
import { ComplianceBadge } from "@/components/ui/ComplianceBadge";

type SummaryState = Record<string, ResolutionSummary | null>;

/**
 * Fetches resolution_summary for each resolved change. Refetches whenever
 * the set of resolved ids changes and replaces wholesale, so a demo reset
 * followed by a re-resolve never shows stale data.
 */
function useResolvedSummaries(resolvedIds: string[]): SummaryState {
  const [summaries, setSummaries] = useState<SummaryState>({});
  const idsKey = resolvedIds.join("|");

  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        getPayerChangeAudit(id)
          .then((res) => [id, res.resolution_summary] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next: SummaryState = {};
      for (const [id, summary] of entries) next[id] = summary;
      setSummaries(next);
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return summaries;
}

export function ResolvedSummariesTable({
  resolvedConflicts,
}: {
  resolvedConflicts: PayerChange[];
}) {
  const summaries = useResolvedSummaries(resolvedConflicts.map((c) => c.id));
  const count = resolvedConflicts.length;

  return (
    <section className="card overflow-hidden" aria-label="Resolved summaries">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--ink)]">
            Resolved summaries
          </h2>
          <p className="provenance mt-0.5">
            {count} change{count === 1 ? "" : "s"} resolved by {FRM_NAME}
          </p>
        </div>
        <ComplianceBadge />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">
            Plan conflicts resolved, with corrected path and communication scope
          </caption>
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--page-bg)]">
              <th scope="col" className="eyebrow px-6 py-2.5">Plan</th>
              <th scope="col" className="eyebrow px-4 py-2.5">Corrected path</th>
              <th scope="col" className="eyebrow px-4 py-2.5">Effective</th>
              <th scope="col" className="eyebrow px-4 py-2.5">Resolved</th>
              <th scope="col" className="eyebrow px-4 py-2.5 text-right">Accounts</th>
              <th scope="col" className="eyebrow px-6 py-2.5 text-right">Materials</th>
            </tr>
          </thead>
          <tbody>
            {resolvedConflicts.map((c) => {
              const summary = summaries[c.id];
              const corrected =
                summary?.corrected_path_value ??
                c.corrected_path_value ??
                c.authoritative.value;
              const source =
                summary?.corrected_path_source ??
                c.corrected_path_source ??
                c.authoritative.source;
              const resolvedBy = summary?.resolved_by ?? c.resolved_by ?? FRM_NAME;
              const resolvedAt = summary?.resolved_at ?? c.resolved_at ?? null;
              const accounts = summary
                ? summary.accounts_notified.length
                : c.affected_account_ids.length;
              const materials =
                summary === undefined
                  ? "…"
                  : summary === null
                    ? "—"
                    : String(summary.materials_sent.length);
              return (
                <tr key={c.id} className="border-b border-[var(--border)]">
                  <td className="px-6 py-3">
                    <p className="font-semibold text-[var(--ink)]">
                      {c.payer_name} — {c.plan_name}
                    </p>
                    <p className="provenance mt-0.5">{c.change_type_group}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--green)]">{corrected}</p>
                    <p className="provenance mt-0.5">
                      {source} · {c.authoritative.source_date}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--ink)]">
                    {formatDate(c.effective_date)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--ink)]">{resolvedBy}</p>
                    <p className="provenance mt-0.5">
                      {resolvedAt ? formatTimestamp(resolvedAt) : "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--ink)]">
                    {accounts}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-[var(--ink)]">
                    {materials}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="provenance px-6 py-3">
        Territory-level resolution — one record per plan conflict. Accounts are
        notified via the compliance-reviewed email template.
      </p>
    </section>
  );
}

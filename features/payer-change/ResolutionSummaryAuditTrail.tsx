"use client";

import { useEffect, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import type { PayerChange } from "@/lib/types";
import { formatDate, formatTimestamp } from "@/lib/format";
import { FRM_NAME } from "@/data/synthetic";
import { getPayerChangeAudit, type PayerChangeAuditResponse } from "@/services/api";
import { ComplianceBadge } from "@/components/ui/ComplianceBadge";

function AuditEventRow({
  event,
  actor,
  ts,
  last,
}: {
  event: string;
  actor: string;
  ts: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-4">
      {!last && (
        <span
          aria-hidden
          className="absolute left-[3px] top-3 h-full w-px bg-[var(--border)]"
        />
      )}
      <span
        aria-hidden
        className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--muted)]"
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--ink)]">{event}</p>
        <p className="provenance">
          {actor} · {ts}
        </p>
      </div>
    </li>
  );
}

function ResolvedChangeCard({ changeId }: { changeId: string }) {
  const [audit, setAudit] = useState<PayerChangeAuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPayerChangeAudit(changeId)
      .then((res) => {
        if (!cancelled) setAudit(res);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load audit.");
      });
    return () => {
      cancelled = true;
    };
  }, [changeId]);

  if (error) {
    return (
      <article className="rounded-xl border border-red-300 bg-red-50 p-5 text-[13px] text-red-700">
        {error}
      </article>
    );
  }
  if (!audit) {
    return (
      <article className="rounded-xl border border-[var(--border)] p-5">
        <p className="provenance">Loading audit trail…</p>
      </article>
    );
  }

  const { change, audit_events, resolution_summary } = audit;
  const typeLabel = change.change_type_group;
  const planLabel = change.plan_name;
  // Truth rule: show ONLY what was actually recorded. The resolve endpoint
  // always stamps corrected_path_* on the change, so no fallback to the
  // reference (authoritative) values — those are inputs, not events.
  const corrected = resolution_summary.corrected_path_value;
  const correctedSource = resolution_summary.corrected_path_source;
  // "Accounts notified" is true only when a Notification record exists.
  // The audit endpoint resolves each ID to the account's display name.
  const notifiedAccounts = resolution_summary.accounts_notified;
  const notified = notifiedAccounts.length;
  const materials = resolution_summary.materials_sent;
  const resolvedTs = resolution_summary.resolved_at
    ? formatTimestamp(resolution_summary.resolved_at)
    : "";

  return (
    <article
      key={change.id}
      className="rounded-xl border border-[var(--border)] p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--green-border)] text-white"
        >
          <Check size={14} strokeWidth={3} />
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-[var(--ink)]">
            {change.payer_name} — {planLabel} · {typeLabel}
          </h3>
          <p className="provenance mt-0.5">
            Resolved by {resolution_summary.resolved_by ?? change.resolved_by} ·{" "}
            {resolvedTs}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* LEFT — corrected path + audit timeline */}
        <div>
          <p className="eyebrow mb-2">Corrected path</p>
          <div className="rounded-xl border border-[var(--green-border)] bg-[var(--green-bg)] px-4 py-3">
            {corrected ? (
              <>
                <p className="text-[14px] font-semibold text-[var(--green)]">
                  {corrected}
                </p>
                <p className="provenance mt-1.5">
                  {correctedSource} · {change.authoritative.source_date} ·{" "}
                  {planLabel}
                </p>
              </>
            ) : (
              <p className="provenance text-[var(--muted)]">
                Not recorded — no corrected path was selected for this conflict.
              </p>
            )}
            <p className="provenance">
              Effective: {formatDate(change.effective_date)}
            </p>
          </div>

          <p className="eyebrow mb-2 mt-4">Audit trail</p>
          <ol>
            {audit_events.map((e, i) => (
              <AuditEventRow
                key={e.id}
                event={e.description}
                actor={e.actor}
                ts={formatTimestamp(e.at)}
                last={i === audit_events.length - 1}
              />
            ))}
          </ol>
        </div>

        {/* RIGHT — accounts notified + materials sent (truth: from records) */}
        <div>
          <p className="eyebrow mb-2">Accounts notified ({notified})</p>
          {notified === 0 ? (
            <p className="provenance">
              None yet — no notification has been sent for this conflict.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notifiedAccounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <span className="text-[13px] font-semibold text-[var(--ink)]">
                    {account.name}
                  </span>
                  <span className="text-[10px] font-semibold tracking-wide text-[var(--green)]">
                    NOTIFIED
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="eyebrow mb-2 mt-4">
            Materials sent ({materials.length})
          </p>
          {materials.length === 0 ? (
            <p className="provenance">
              None yet — no materials have been sent for this conflict.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {materials.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <span className="text-[13px] font-semibold text-[var(--ink)]">
                    {m.title}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-[var(--green)]">
                    <ShieldCheck size={11} aria-hidden />
                    COMPLIANCE-REVIEWED
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

export function ResolutionSummaryAuditTrail({
  resolvedConflicts,
}: {
  resolvedConflicts: PayerChange[];
}) {
  const resolvedCount = resolvedConflicts.length;
  return (
    <section className="card p-6" aria-label="Resolution summary and audit trail">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--ink)]">
            Resolution Summary &amp; Audit Trail
          </h2>
          <p className="provenance mt-0.5">
            {resolvedCount} conflict{resolvedCount === 1 ? "" : "s"} resolved by{" "}
            {FRM_NAME}
          </p>
        </div>
        <ComplianceBadge />
      </div>

      {resolvedCount === 0 && (
        <p className="provenance">No conflicts resolved yet.</p>
      )}

      <div className="flex flex-col gap-6">
        {resolvedConflicts.map((c) => (
          <ResolvedChangeCard key={c.id} changeId={c.id} />
        ))}
      </div>
    </section>
  );
}

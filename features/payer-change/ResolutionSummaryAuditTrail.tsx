import { Check, ShieldCheck } from "lucide-react";
import type { Conflict } from "@/data/synthetic";
import { CONFLICT_TYPE_LABEL, FRM_NAME, SOURCE, SOURCE_UPDATED, TERRITORY } from "@/data/synthetic";
import { ComplianceBadge } from "@/components/ui/ComplianceBadge";
import { plural } from "@/lib/plural";

function AuditEvent({
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

export function ResolutionSummaryAuditTrail({
  resolvedConflicts,
}: {
  resolvedConflicts: Conflict[];
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
        {resolvedConflicts.map((c) => {
          const typeLabel = CONFLICT_TYPE_LABEL[c.conflictType];
          const planLabel = c.plan.plan_name;
          const accounts = c.accounts;
          // Truth: only what actually happened in this resolution.
          const notifiedAccounts = accounts.filter((a) => a.notified);
          const resolvedAccounts = accounts.filter((a) => a.resolved);
          const materials = c.materials;
          const resolvedTs = c.resolved_at ?? "";
          return (
            <article
              key={c.id}
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
                    {c.plan.payer} — {planLabel} · {typeLabel}
                  </h3>
                  <p className="provenance mt-0.5">
                    Resolved by {c.resolved_by} · {resolvedTs}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* LEFT — corrected path + audit timeline */}
                <div>
                  <p className="eyebrow mb-2">Corrected path</p>
                  <div className="rounded-xl border border-[var(--green-border)] bg-[var(--green-bg)] px-4 py-3">
                    <p className="text-[14px] font-semibold text-[var(--green)]">
                      {c.new_value}
                    </p>
                    <p className="provenance mt-1.5">
                      {SOURCE} · {SOURCE_UPDATED} · {planLabel}
                    </p>
                    <p className="provenance">Effective: {c.effective_date}</p>
                  </div>

                  <p className="eyebrow mb-2 mt-4">Audit trail</p>
                  <ol>
                    <AuditEvent
                      event={`${SOURCE} policy update detected`}
                      actor="System"
                      ts={resolvedTs}
                    />
                    <AuditEvent
                      event={`Conflict flagged: ${accounts.length} ${plural(accounts.length, "account")} in ${TERRITORY}`}
                      actor="System"
                      ts={resolvedTs}
                    />
                    <AuditEvent
                      event={`Corrected path selected: "${c.new_value}"`}
                      actor={FRM_NAME}
                      ts={resolvedTs}
                    />
                    <AuditEvent
                      event={`${resolvedAccounts.length} ${plural(resolvedAccounts.length, "account")} resolved at territory level`}
                      actor={FRM_NAME}
                      ts={resolvedTs}
                    />
                    <AuditEvent
                      event={`${materials.length} compliance-reviewed ${plural(materials.length, "material")} attached`}
                      actor={FRM_NAME}
                      ts={resolvedTs}
                    />
                    <AuditEvent
                      event={`Corrected path communicated to ${notifiedAccounts.length} ${plural(notifiedAccounts.length, "office")}`}
                      actor={FRM_NAME}
                      ts={resolvedTs}
                    />
                    <AuditEvent
                      event="Resolution recorded in audit log"
                      actor="System"
                      ts={resolvedTs}
                      last
                    />
                  </ol>
                </div>

                {/* RIGHT — accounts notified + materials sent */}
                <div>
                  <p className="eyebrow mb-2">
                    Accounts notified ({notifiedAccounts.length} {plural(notifiedAccounts.length, "office")})
                  </p>
                  <ul className="flex flex-col gap-2">
                    {notifiedAccounts.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--ink)]">
                            {a.name}
                          </span>
                          <span className="provenance rounded border border-[var(--border)] px-1.5 py-0.5">
                            {planLabel}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold tracking-wide text-[var(--green)]">
                          RESOLVED
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="eyebrow mb-2 mt-4">
                    Materials sent ({materials.length} {plural(materials.length, "material")})
                  </p>
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
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

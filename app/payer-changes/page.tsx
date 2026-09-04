"use client";

import { useMemo, useState } from "react";
import {
  CONFLICT_TYPE_LABEL,
  type Conflict,
  type ConflictType,
} from "@/data/synthetic";
import {
  selectOpenCount,
  selectResolvedConflicts,
  selectResolvedCount,
  useConflictState,
} from "@/store/ConflictStore";
import { StatusPill } from "@/components/ui/StatusPill";
import { ValueTransition } from "@/components/ui/ValueTransition";
import { ProvenanceMeta } from "@/components/ui/ProvenanceMeta";
import { Accordion } from "@/components/ui/Accordion";
import { ResolutionSummaryAuditTrail } from "@/features/payer-change/ResolutionSummaryAuditTrail";
import { AppShell } from "@/components/layout/AppShell";
import { PayerChangeDrawer } from "@/features/payer-change/PayerChangeDrawer";
import { plural } from "@/lib/plural";

function ChangeRow({
  conflict,
  onReview,
}: {
  conflict: Conflict;
  onReview: (id: string) => void;
}) {
  const resolved = conflict.status === "resolved";
  return (
    <div className="flex items-start justify-between gap-6 px-6 py-4 [&+&]:border-t [&+&]:border-[var(--border)]">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2.5">
          <h3 className="text-[14px] font-bold text-[var(--ink)]">
            {conflict.plan.payer} — {conflict.plan.plan_name}
          </h3>
          {resolved && <StatusPill variant="resolved" />}
        </div>
        <ValueTransition
          old={conflict.old_value}
          current={conflict.new_value}
          tone={resolved ? "resolved" : "open"}
        />
        <div className="mt-1.5">
          {resolved ? (
            <ProvenanceMeta
              parts={[
                `${conflict.notified_offices ?? conflict.accounts.length} ${plural(conflict.notified_offices ?? conflict.accounts.length, "account")} resolved`,
                `Eff. ${conflict.effective_date}`,
                `by ${conflict.resolved_by}`,
                conflict.resolved_at ?? "",
              ]}
            />
          ) : (
            <ProvenanceMeta
              parts={[
                `${conflict.accounts.length} ${plural(conflict.accounts.length, "account")} affected`,
                `Eff. ${conflict.effective_date}`,
              ]}
            />
          )}
        </div>
      </div>
      {!resolved && (
        <button
          type="button"
          onClick={() => onReview(conflict.id)}
          className="mt-1 shrink-0 rounded-lg border border-[var(--indigo)] px-4 py-1.5 text-[13px] font-semibold text-[var(--indigo)] transition-colors hover:bg-[var(--indigo-bg)]"
        >
          Review →
        </button>
      )}
    </div>
  );
}

export default function PayerChangesPage() {
  const { conflicts } = useConflictState();
  const [drawerConflictId, setDrawerConflictId] = useState<string | null>(null);

  const openCount = selectOpenCount(conflicts);
  const resolvedCount = selectResolvedCount(conflicts);
  const resolvedConflicts = useMemo(
    () => selectResolvedConflicts(conflicts),
    [conflicts],
  );

  const groups = useMemo(() => {
    const byType = new Map<ConflictType, Conflict[]>();
    for (const c of conflicts) {
      const list = byType.get(c.conflictType) ?? [];
      list.push(c);
      byType.set(c.conflictType, list);
    }
    return [...byType.entries()];
  }, [conflicts]);

  const drawerConflict = conflicts.find((c) => c.id === drawerConflictId) ?? null;

  return (
    <AppShell>
      <main className="mx-auto max-w-[1440px] px-8 py-6">
      {/* Banner — conflict is the hero */}
      <section className="card overflow-hidden" aria-label="Payer change alert">
        <div className="bg-[var(--magenta)] px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[18px] font-bold text-white">Payer Change</h1>
            <StatusPill variant="open" count={openCount} />
            <span className="text-[13px] text-white/90">
              · {resolvedCount} of {conflicts.length} plan conflicts resolved
              today
            </span>
          </div>
        </div>
      </section>

      {/* Accordions grouped by conflict type */}
      <div className="mt-4 flex flex-col gap-4">
        {groups.map(([type, list]) => {
          const openPlans = list.filter((c) => c.status === "open").length;
          return (
            <Accordion
              key={type}
              title={CONFLICT_TYPE_LABEL[type]}
              right={
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--magenta)]">
                  {openPlans} {plural(openPlans, "plan")} open
                </span>
              }
            >
              <div>
                {list.map((c) => (
                  <ChangeRow
                    key={c.id}
                    conflict={c}
                    onReview={setDrawerConflictId}
                  />
                ))}
              </div>
            </Accordion>
          );
        })}
      </div>

      {/* Resolution Summary & Audit Trail */}
      <div className="mt-4">
        <ResolutionSummaryAuditTrail resolvedConflicts={resolvedConflicts} />
      </div>

      {drawerConflict && (
        <PayerChangeDrawer
          conflict={drawerConflict}
          openCount={openCount}
          onClose={() => setDrawerConflictId(null)}
        />
      )}
      </main>
    </AppShell>
  );
}

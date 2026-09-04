"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ChangeTypeGroup, PayerChange } from "@/lib/types";
import { GROUP_ORDER } from "@/lib/types";
import { formatDate, formatTimestamp } from "@/lib/format";
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
  change,
  onReview,
}: {
  change: PayerChange;
  onReview: (id: string) => void;
}) {
  const resolved = change.status === "resolved";
  return (
    <div className="flex items-start justify-between gap-6 px-6 py-4 [&+&]:border-t [&+&]:border-[var(--border)]">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2.5">
          <h3 className="text-[14px] font-bold text-[var(--ink)]">
            {change.payer_name} — {change.plan_name}
          </h3>
          {resolved && <StatusPill variant="resolved" />}
        </div>
        <ValueTransition
          old={change.previous.value}
          current={change.authoritative.value}
          tone={resolved ? "resolved" : "open"}
        />
        <div className="mt-1.5">
          {resolved ? (
            <ProvenanceMeta
              parts={[
                `${(change.resolved_account_ids ?? change.affected_account_ids).length} ${plural((change.resolved_account_ids ?? change.affected_account_ids).length, "account")} resolved`,
                `Eff. ${formatDate(change.effective_date)}`,
                `by ${change.resolved_by ?? ""}`,
                change.resolved_at ? formatTimestamp(change.resolved_at) : "",
              ]}
            />
          ) : (
            <ProvenanceMeta
              parts={[
                `${change.affected_account_ids.length} ${plural(change.affected_account_ids.length, "account")} affected`,
                `Eff. ${formatDate(change.effective_date)}`,
              ]}
            />
          )}
        </div>
      </div>
      {!resolved && (
        <button
          type="button"
          onClick={() => onReview(change.id)}
          className="mt-1 shrink-0 rounded-lg border border-[var(--indigo)] px-4 py-1.5 text-[13px] font-semibold text-[var(--indigo)] transition-colors hover:bg-[var(--indigo-bg)]"
        >
          Review →
        </button>
      )}
    </div>
  );
}

export default function PayerChangesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { conflicts, loading, error } = useConflictState();
  const [drawerChangeId, setDrawerChangeId] = useState<string | null>(null);
  const reviewPlanId = searchParams.get("reviewPlan");
  const reviewedChangeId =
    conflicts.find((conflict) => conflict.plan_id === reviewPlanId)?.id ??
    drawerChangeId;

  const openCount = selectOpenCount(conflicts);
  const resolvedCount = selectResolvedCount(conflicts);
  const resolvedConflicts = useMemo(
    () => selectResolvedConflicts(conflicts),
    [conflicts],
  );

  // Group by change_type_group in canonical GROUP_ORDER.
  const groups = useMemo(() => {
    const byGroup = new Map<ChangeTypeGroup, PayerChange[]>();
    for (const c of conflicts) {
      const list = byGroup.get(c.change_type_group) ?? [];
      list.push(c);
      byGroup.set(c.change_type_group, list);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map(
      (group) => [group, byGroup.get(group) ?? []] as const,
    );
  }, [conflicts]);

  const drawerChange =
    conflicts.find((c) => c.id === reviewedChangeId) ?? null;
  const closeDrawer = () => {
    setDrawerChangeId(null);
    if (reviewPlanId) router.replace("/payer-changes");
  };

  return (
    <AppShell>
      {/* w-full: body is a column flex container, so mx-auto alone would
          disable stretch and shrink-wrap main to its content (mobile-like
          narrow column). w-full restores desktop full-width up to max-w. */}
      <main className="mx-auto w-full max-w-[1440px] px-8 py-6">
      {/* Banner — conflict is the hero */}
      <section className="card overflow-hidden" aria-label="Payer change alert">
        <div className="bg-[var(--magenta)] px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[18px] font-bold text-white">Payer Change</h1>
            <StatusPill variant="open" count={openCount} />
            <span className="text-[13px] text-white/90">
              · {resolvedCount} of {conflicts.length} plan{" "}
              {conflicts.length === 1 ? "conflict" : "conflicts"} resolved today
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {loading && conflicts.length === 0 && (
        <p className="provenance mt-4">Loading payer changes…</p>
      )}

      {/* Accordions grouped by change type group */}
      <div className="mt-4 flex flex-col gap-4">
        {groups.map(([group, list]) => {
          const openPlans = list.filter((c) => c.status === "open").length;
          return (
            <Accordion
              key={group}
              title={group}
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
                    change={c}
                    onReview={setDrawerChangeId}
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

      {drawerChange && (
        <PayerChangeDrawer
          key={drawerChange.id}
          change={drawerChange}
          openCount={openCount}
          onClose={closeDrawer}
        />
      )}
      </main>
    </AppShell>
  );
}

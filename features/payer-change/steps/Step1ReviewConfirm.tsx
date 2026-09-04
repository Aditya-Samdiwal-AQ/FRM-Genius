"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { PayerChange } from "@/lib/types";
import type { DetailAccount } from "@/services/api";
import { formatDate } from "@/lib/format";
import { PRODUCT, SOURCE, TERRITORY } from "@/data/synthetic";
import { ComplianceBadge } from "@/components/ui/ComplianceBadge";
import { CheckboxCard } from "@/components/ui/CheckboxCard";
import { InfoBox } from "@/components/ui/InfoBox";

export function Step1ReviewConfirm({
  change,
  accounts,
  selectedIds,
  onToggle,
}: {
  change: PayerChange;
  accounts: DetailAccount[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const typeLabel = change.change_type_group;
  const planLabel = change.plan_name;
  const payerLabel = change.payer_name;
  const selectedCount = selectedIds.length;
  const totalCount = accounts.length;

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div>
        <p className="eyebrow">{typeLabel}</p>
        <h2 className="mt-1 text-[20px] font-bold text-[var(--ink)]">
          {payerLabel} — {planLabel}
        </h2>
        <p className="provenance mt-1">
          {PRODUCT} · {TERRITORY} · Eff. {formatDate(change.effective_date)} ·
          Source: {SOURCE}
        </p>
      </div>

      {/* POLICY CHANGE — two radio cards */}
      <section aria-label="Policy change">
        <p className="eyebrow mb-2">Policy change</p>
        <div className="flex flex-col gap-3">
          {/* Card A — superseded */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--page-bg)] px-4 py-3">
            <div className="mb-1 flex items-center gap-2">
              <span
                aria-hidden
                className="h-4 w-4 rounded-full border-2 border-[var(--muted)]"
              />
              <span className="eyebrow">Previous — superseded</span>
            </div>
            <p className="text-[14px] text-[var(--muted)] line-through">
              {change.previous.value}
            </p>
            <p className="provenance mt-1.5">
              {change.previous.source} · {change.previous.source_date} ·{" "}
              {planLabel}
            </p>
          </div>

          {/* Card B — authoritative */}
          <div className="rounded-xl border-2 border-[var(--green-border)] bg-[var(--green-bg)] px-4 py-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                aria-hidden
                className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--green-border)] text-white"
              >
                <Check size={11} strokeWidth={3} />
              </span>
              <span className="eyebrow text-[var(--green)]">
                Authoritative — {payerLabel} · {planLabel}
              </span>
              <ComplianceBadge />
            </div>
            <p className="text-[15px] font-bold text-[var(--ink)]">
              {change.authoritative.value}
            </p>
            <p className="provenance mt-1.5">
              Eff. {formatDate(change.effective_date)} · Source:{" "}
              {change.authoritative.source} · {change.authoritative.source_date}
            </p>
          </div>
        </div>
      </section>

      {/* ACCOUNTS TO RESOLVE */}
      <section aria-label="Accounts to resolve">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">
            Accounts to resolve ({selectedCount} of {totalCount} selected)
          </p>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="text-[12px] font-semibold text-[var(--indigo)] hover:underline"
          >
            {showDetail ? "Hide detail" : "Show detail"}
          </button>
        </div>
        {showDetail && (
          <p className="provenance mb-2">
            Affected accounts are pre-selected because the conflict is resolved
            once at territory level — never account by account.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {accounts.map((a) => (
            <CheckboxCard
              key={a.id}
              checked={selectedIds.includes(a.id)}
              onChange={() => onToggle(a.id)}
              title={a.name}
              subtitle={`${a.payer_name} · ${a.plan_name} · ${a.email}`}
              right={
                showDetail ? (
                  <span className="provenance">{a.channel}</span>
                ) : undefined
              }
            />
          ))}
        </div>
      </section>

      {/* Action summary */}
      <InfoBox variant="green">
        <p className="font-semibold text-[var(--ink)]">
          {selectedCount} {selectedCount === 1 ? "account" : "accounts"} will be
          updated to: {change.authoritative.value}
        </p>
        <p className="mt-0.5 text-[var(--muted)]">
          System-generated from {SOURCE} data. Jordan Lee remains the
          decision-maker.
        </p>
      </InfoBox>
    </div>
  );
}

"use client";

import type { PayerChange } from "@/lib/types";
import type { Material } from "@/lib/types";
import type { DetailAccount } from "@/services/api";
import { formatDate } from "@/lib/format";
import {
  FRM_NAME,
  FRM_TITLE,
  PRODUCT,
  TERRITORY,
} from "@/data/synthetic";
import { ComplianceBadge } from "@/components/ui/ComplianceBadge";
import { InfoBox } from "@/components/ui/InfoBox";

export function Step3Communicate({
  change,
  materials,
  recipients,
}: {
  change: PayerChange;
  materials: Material[];
  recipients: DetailAccount[];
}) {
  const typeLabel = change.change_type_group;
  const planLabel = change.plan_name;
  const corrected =
    change.corrected_path_value ?? change.authoritative.value;
  const source = change.corrected_path_source ?? change.authoritative.source;
  const sourceDate = change.authoritative.source_date;
  const count = recipients.length;

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {/* RECIPIENTS */}
      <section aria-label="Recipients">
        <p className="eyebrow mb-2">Recipients ({count} offices)</p>
        <div className="flex flex-wrap gap-2">
          {recipients.map((r) => (
            <span
              key={r.id}
              className="provenance rounded-full border border-[var(--border)] bg-[var(--page-bg)] px-3 py-1"
            >
              {r.name} · {r.plan_name}
            </span>
          ))}
        </div>
      </section>

      {/* MESSAGE PREVIEW — email card */}
      <section aria-label="Message preview">
        <p className="eyebrow mb-2">Message preview</p>
        <div className="rounded-xl border border-[var(--border)]">
          {/* Header block */}
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 text-[13px]">
                <p>
                  <span className="font-semibold text-[var(--ink)]">To:</span>{" "}
                  <span className="text-[var(--muted)]">
                    {count} selected offices — {TERRITORY}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-[var(--ink)]">Re:</span>{" "}
                  <span className="text-[var(--muted)]">
                    {PRODUCT} {typeLabel} Update — Corrected Path
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-[var(--ink)]">From:</span>{" "}
                  <span className="text-[var(--muted)]">
                    {FRM_NAME}, FRM · {TERRITORY}
                  </span>
                </p>
              </div>
              <ComplianceBadge />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 px-4 py-4 text-[13px] leading-relaxed text-[var(--ink)]">
            <p>Dear Office,</p>
            <p>
              This message confirms an update to the{" "}
              <strong>{typeLabel}</strong> guidance for <strong>{PRODUCT}</strong>{" "}
              administered through your plan.
            </p>

            {/* UPDATED GUIDANCE box */}
            <div className="rounded-xl border border-[var(--indigo)] bg-[var(--indigo-bg)] px-4 py-3">
              <p className="eyebrow text-[var(--indigo)]">Updated guidance</p>
              <p className="mt-1 text-[14px] font-bold text-[var(--indigo-dark)]">
                {corrected}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="provenance rounded border border-[var(--border)] bg-white px-2 py-0.5">
                  {source} · {sourceDate} · {planLabel}
                </span>
                <span className="provenance rounded border border-[var(--border)] bg-white px-2 py-0.5">
                  Effective: {formatDate(change.effective_date)}
                </span>
              </div>
            </div>

            <p>
              This update reflects the latest authoritative payer policy from{" "}
              <strong>{source}</strong>, effective{" "}
              <strong>{formatDate(change.effective_date)}</strong>. Please update
              your office workflows accordingly.
            </p>

            {/* ATTACHED MATERIALS */}
            <div>
              <p className="eyebrow mb-1.5">Attached materials</p>
              <ul className="flex flex-col gap-1.5">
                {materials.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5"
                  >
                    <span className="text-[13px] font-semibold">
                      {m.title}
                    </span>
                    <ComplianceBadge />
                  </li>
                ))}
              </ul>
            </div>

            {/* Signature */}
            <div className="border-t border-[var(--border)] pt-3">
              <p className="font-semibold">
                {FRM_NAME} — {FRM_TITLE}, Oncology &amp; Rare Disease
              </p>
              <p className="provenance mt-0.5">
                {TERRITORY} · {formatDate(change.effective_date)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Template notice */}
      <InfoBox variant="gray">
        Generated from a compliance-reviewed, MLR-approved template. No
        free-text promotional content included. Source provenance ({source} ·{" "}
        {sourceDate}) is embedded throughout.
      </InfoBox>
    </div>
  );
}

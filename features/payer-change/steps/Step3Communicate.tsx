"use client";

import type { Account, Conflict, Material } from "@/data/synthetic";
import {
  CONFLICT_TYPE_LABEL,
  FRM_NAME,
  FRM_TITLE,
  PRODUCT,
  SOURCE,
  SOURCE_UPDATED,
  TERRITORY,
} from "@/data/synthetic";
import { ComplianceBadge } from "@/components/ui/ComplianceBadge";
import { InfoBox } from "@/components/ui/InfoBox";
import { plural } from "@/lib/plural";

export function Step3Communicate({
  conflict,
  materials,
  recipients,
}: {
  conflict: Conflict;
  materials: Material[];
  recipients: Account[];
}) {
  const typeLabel = CONFLICT_TYPE_LABEL[conflict.conflictType];
  const planLabel = conflict.plan.plan_name;
  const count = recipients.length;

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {/* RECIPIENTS */}
      <section aria-label="Recipients">
        <p className="eyebrow mb-2">Recipients ({count} {plural(count, "office")})</p>
        <div className="flex flex-wrap gap-2">
          {recipients.map((r) => (
            <span
              key={r.id}
              className="provenance rounded-full border border-[var(--border)] bg-[var(--page-bg)] px-3 py-1"
            >
              {r.name} · {planLabel}
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
                    {count} selected {plural(count, "office")} — Territory 14
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
                {conflict.new_value}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="provenance rounded border border-[var(--border)] bg-white px-2 py-0.5">
                  {SOURCE} · {SOURCE_UPDATED} · {planLabel}
                </span>
                <span className="provenance rounded border border-[var(--border)] bg-white px-2 py-0.5">
                  Effective: {conflict.effective_date}
                </span>
              </div>
            </div>

            <p>
              This update reflects the latest authoritative payer policy from{" "}
              <strong>{SOURCE}</strong>, effective{" "}
              <strong>{conflict.effective_date}</strong>. Please update your
              office workflows accordingly.
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
                {TERRITORY} · August 26, 2026
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Template notice */}
      <InfoBox variant="gray">
        Generated from a compliance-reviewed, MLR-approved template. No
        free-text promotional content included. Source provenance ({SOURCE} ·{" "}
        {SOURCE_UPDATED}) is embedded throughout.
      </InfoBox>
    </div>
  );
}

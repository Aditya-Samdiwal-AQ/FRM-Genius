"use client";

import type { ConflictType } from "@/data/synthetic";
import { CONFLICT_TYPE_LABEL } from "@/data/synthetic";
import { InfoBox } from "@/components/ui/InfoBox";

export function ConfirmSendDialog({
  recipientsCount,
  conflictType,
  onConfirm,
  onCancel,
  sending,
  error,
}: {
  recipientsCount: number;
  conflictType: ConflictType;
  onConfirm: () => void;
  onCancel: () => void;
  sending: boolean;
  error?: string;
}) {
  const typeLabel = CONFLICT_TYPE_LABEL[conflictType];
  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
      {error && (
        <div className="mb-3">
          <InfoBox variant="error">
            <p className="font-semibold text-red-700">
              The email could not be sent.
            </p>
            <p className="text-red-700">{error} You can retry — the conflict
            has not been resolved.</p>
          </InfoBox>
        </div>
      )}
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[var(--ink)]">
            Send to {recipientsCount} offices?
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--muted)]">
            This will notify {recipientsCount} offices of the corrected{" "}
            {typeLabel} guidance. The email is generated from the
            compliance-reviewed template above.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--page-bg)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending}
            className="rounded-lg bg-[var(--indigo-dark)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--indigo)] disabled:opacity-60"
          >
            {sending ? "Sending…" : "Confirm & send"}
          </button>
        </div>
      </div>
    </div>
  );
}

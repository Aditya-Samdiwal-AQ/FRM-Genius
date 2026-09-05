"use client";

import type { ChangeTypeGroup } from "@/lib/types";
import type { DetailAccount } from "@/services/api";
import { InfoBox } from "@/components/ui/InfoBox";
import { plural } from "@/lib/plural";

export function ConfirmSendDialog({
  recipientsCount,
  recipients,
  changeTypeGroup,
  planName,
  onConfirm,
  onCancel,
  sending,
  error,
}: {
  recipientsCount: number;
  recipients: DetailAccount[];
  changeTypeGroup: ChangeTypeGroup;
  planName: string;
  onConfirm: () => void;
  onCancel: () => void;
  sending: boolean;
  error?: string;
}) {
  const typeLabel = changeTypeGroup;
  const recipientEmails = recipients.map((recipient) => recipient.email).join(", ");
  const subject = `${typeLabel} update for ${planName}`;
  const body = [
    "Dear Office,",
    "",
    `This message confirms an update to the ${typeLabel} guidance for ${planName}.`,
    "Please review the corrected guidance and update internal workflows accordingly.",
    "",
    "Thank you,",
    "FRM Team",
  ].join("\n");

  const handleSend = () => {
    if (typeof window === "undefined") {
      onConfirm();
      return;
    }

    const mailtoHref = `mailto:${encodeURIComponent(recipientEmails)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoHref;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Email composer
            </p>
            <p className="mt-1 text-[16px] font-bold text-[var(--ink)]">
              Send to {recipientsCount} {plural(recipientsCount, "office")}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--page-bg)]"
          >
            Close
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-5">
          {error && (
            <div className="mb-4">
              <InfoBox variant="error">
                <p className="font-semibold text-red-700">
                  The email could not be sent.
                </p>
                <p className="text-red-700">
                  {error} You can retry — the change has not been resolved.
                </p>
              </InfoBox>
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                To
              </span>
              <textarea
                readOnly
                value={recipientEmails}
                className="min-h-[88px] w-full rounded-xl border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-[13px] text-[var(--ink)]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                Subject
              </span>
              <input
                readOnly
                value={subject}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-[13px] text-[var(--ink)]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                Message
              </span>
              <textarea
                readOnly
                value={body}
                className="min-h-[220px] w-full rounded-xl border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-[13px] leading-6 text-[var(--ink)]"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
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
            onClick={handleSend}
            disabled={sending}
            className="rounded-lg bg-[var(--indigo-dark)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--indigo)] disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send email"}
          </button>
        </div>
      </div>
    </div>
  );
}

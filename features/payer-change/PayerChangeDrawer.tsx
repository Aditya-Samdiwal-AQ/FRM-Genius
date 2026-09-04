"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conflict } from "@/data/synthetic";
import {
  CONFLICT_TYPE_LABEL,
  FRM_NAME,
  PRODUCT,
  SOURCE,
  SOURCE_UPDATED,
  TERRITORY,
} from "@/data/synthetic";
import { useConflictDispatch } from "@/store/ConflictStore";
import { sendNotificationEmail } from "@/services/api";
import { Drawer, DrawerHeader } from "@/components/ui/Drawer";
import { Stepper } from "@/components/ui/Stepper";
import { Step1ReviewConfirm } from "@/features/payer-change/steps/Step1ReviewConfirm";
import { Step2Materials } from "@/features/payer-change/steps/Step2Materials";
import { Step3Communicate } from "@/features/payer-change/steps/Step3Communicate";
import { ConfirmSendDialog } from "@/features/payer-change/ConfirmSendDialog";
import { plural } from "@/lib/plural";

type Step = 1 | 2 | 3;

function buildMessageHtml(conflict: Conflict, materials: { title: string }[]): string {
  const typeLabel = CONFLICT_TYPE_LABEL[conflict.conflictType];
  return [
    `<p>Dear Office,</p>`,
    `<p>This message confirms an update to the ${typeLabel} guidance for ${PRODUCT} administered through your plan.</p>`,
    `<p><strong>Updated guidance:</strong> ${conflict.new_value}</p>`,
    `<p>Source: ${SOURCE} · ${SOURCE_UPDATED} · ${conflict.plan.plan_name}. Effective: ${conflict.effective_date}.</p>`,
    `<p>Attached materials: ${materials.map((m) => m.title).join("; ")}.</p>`,
    `<p>${FRM_NAME} — Field Reimbursement Manager, Oncology &amp; Rare Disease · ${TERRITORY}</p>`,
  ].join("\n");
}

export function PayerChangeDrawer({
  conflict,
  openCount,
  onClose,
}: {
  conflict: Conflict;
  openCount: number;
  onClose: () => void;
}) {
  const dispatch = useConflictDispatch();
  const [step, setStep] = useState<Step>(1);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    conflict.accounts.map((a) => a.id),
  );
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(
    conflict.materials.map((m) => m.id),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Reset to step 1 whenever a different conflict is opened.
  useEffect(() => {
    setStep(1);
    setSelectedAccountIds(conflict.accounts.map((a) => a.id));
    setSelectedMaterialIds(conflict.materials.map((m) => m.id));
    setConfirmOpen(false);
    setSending(false);
    setError(undefined);
  }, [conflict.id, conflict.accounts, conflict.materials]);

  const selectedMaterials = useMemo(
    () => conflict.materials.filter((m) => selectedMaterialIds.includes(m.id)),
    [conflict.materials, selectedMaterialIds],
  );
  const selectedAccounts = useMemo(
    () => conflict.accounts.filter((a) => selectedAccountIds.includes(a.id)),
    [conflict.accounts, selectedAccountIds],
  );

  const toggleAccount = (id: string) =>
    setSelectedAccountIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  const toggleMaterial = (id: string) =>
    setSelectedMaterialIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const handleConfirmSend = async () => {
    if (sending) return; // double-send protection
    setSending(true);
    setError(undefined);
    try {
      const result = await sendNotificationEmail({
        recipients: selectedAccounts.map((a) => a.name),
        subject: `${PRODUCT} ${CONFLICT_TYPE_LABEL[conflict.conflictType]} Update — Corrected Path`,
        messageHtml: buildMessageHtml(conflict, selectedMaterials),
        materials: selectedMaterials,
        conflict,
      });
      if (!result.ok) {
        setError(result.error ?? "Unknown error.");
        setSending(false);
        return;
      }
      dispatch({
        type: "RESOLVE_CONFLICT",
        conflictId: conflict.id,
        accountIds: selectedAccountIds,
        materialIds: selectedMaterialIds,
        message: buildMessageHtml(conflict, selectedMaterials),
      });
      setSending(false);
      setConfirmOpen(false);
      onClose();
    } catch {
      setError("Network error while dispatching the email.");
      setSending(false);
    }
  };

  const primaryDisabled =
    (step === 1 && selectedAccountIds.length === 0) ||
    (step === 2 && selectedMaterialIds.length === 0);

  const primaryLabel =
    step === 1 ? "Select materials →" : step === 2 ? "Preview message →" : `Send to ${selectedAccountIds.length} ${plural(selectedAccountIds.length, "office")} →`;

  const footer = confirmOpen ? (
    <ConfirmSendDialog
      recipientsCount={selectedAccountIds.length}
      conflictType={conflict.conflictType}
      onConfirm={handleConfirmSend}
      onCancel={() => setConfirmOpen(false)}
      sending={sending}
      error={error}
    />
  ) : (
    <div className="flex items-center justify-between px-6 py-4">
      <button
        type="button"
        onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as Step))}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--page-bg)]"
      >
        {step === 1 ? "Cancel" : "← Back"}
      </button>
      <button
        type="button"
        disabled={primaryDisabled}
        onClick={() =>
          step === 3 ? setConfirmOpen(true) : setStep((s) => (s + 1) as Step)
        }
        className="rounded-lg bg-[var(--indigo-dark)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--indigo)] disabled:opacity-50"
      >
        {primaryLabel}
      </button>
    </div>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      header={<DrawerHeader openCount={openCount} onClose={onClose} />}
      footer={footer}
    >
      <div className="border-b border-[var(--border)] px-6 py-4">
        <Stepper current={step} />
      </div>
      {step === 1 && (
        <Step1ReviewConfirm
          conflict={conflict}
          selectedIds={selectedAccountIds}
          onToggle={toggleAccount}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2Materials
          conflictType={conflict.conflictType}
          materials={conflict.materials}
          selectedIds={selectedMaterialIds}
          onToggle={toggleMaterial}
        />
      )}
      {step === 3 && (
        <Step3Communicate
          conflict={conflict}
          materials={selectedMaterials}
          recipients={selectedAccounts}
        />
      )}
    </Drawer>
  );
}

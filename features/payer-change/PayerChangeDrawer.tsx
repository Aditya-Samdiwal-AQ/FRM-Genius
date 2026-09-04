"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeSource, PayerChange } from "@/lib/types";
import { useConflictActions } from "@/store/ConflictStore";
import { getPayerChangeDetail, type DetailAccount } from "@/services/api";
import type { Material } from "@/lib/types";
import { Drawer, DrawerHeader } from "@/components/ui/Drawer";
import { Stepper } from "@/components/ui/Stepper";
import { Step1ReviewConfirm } from "@/features/payer-change/steps/Step1ReviewConfirm";
import { Step2Materials } from "@/features/payer-change/steps/Step2Materials";
import { Step3Communicate } from "@/features/payer-change/steps/Step3Communicate";
import { ConfirmSendDialog } from "@/features/payer-change/ConfirmSendDialog";

type Step = 1 | 2 | 3;

export function PayerChangeDrawer({
  change,
  openCount,
  onClose,
}: {
  change: PayerChange;
  openCount: number;
  onClose: () => void;
}) {
  const { resolveAndNotify } = useConflictActions();
  const [step, setStep] = useState<Step>(1);
  const [accounts, setAccounts] = useState<DetailAccount[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Fetch detail (accounts + suggested materials) whenever a change is opened.
  // The drawer is keyed by change.id (see page.tsx), so this effect runs once
  // per opened change; initial state already covers the loading case.
  useEffect(() => {
    let cancelled = false;
    getPayerChangeDetail(change.id)
      .then((res) => {
        if (cancelled) return;
        setAccounts(res.accounts);
        setMaterials(res.suggested_materials);
        setSelectedAccountIds(res.accounts.map((a) => a.id));
        setSelectedMaterialIds(res.suggested_materials.map((m) => m.id));
        setDetailLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetailError(
          err instanceof Error ? err.message : "Failed to load detail.",
        );
        setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [change.id]);

  const selectedMaterials = useMemo(
    () => materials.filter((m) => selectedMaterialIds.includes(m.id)),
    [materials, selectedMaterialIds],
  );
  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds],
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
      // Backend contract: resolve first (sets corrected path + audit events),
      // then notify (sends the templated email to affected accounts).
      await resolveAndNotify({
        changeId: change.id,
        correctedPathSource: (change.corrected_path_source ??
          change.authoritative.source) as ChangeSource,
        correctedPathValue:
          change.corrected_path_value ?? change.authoritative.value,
        materialIds: selectedMaterialIds,
      });
      setSending(false);
      setConfirmOpen(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Network error while dispatching the email.",
      );
      setSending(false);
    }
  };

  const primaryDisabled =
    detailLoading ||
    (step === 1 && selectedAccountIds.length === 0) ||
    (step === 2 && selectedMaterialIds.length === 0);

  const primaryLabel =
    step === 1
      ? "Select materials →"
      : step === 2
        ? "Preview message →"
        : `Send to ${selectedAccountIds.length} offices →`;

  const footer = confirmOpen ? (
    <ConfirmSendDialog
      recipientsCount={selectedAccountIds.length}
      changeTypeGroup={change.change_type_group}
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
      {detailError && (
        <div className="px-6 pt-4">
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {detailError}
          </div>
        </div>
      )}
      {detailLoading && (
        <p className="provenance px-6 pt-4">Loading detail…</p>
      )}
      {!detailLoading && !detailError && (
        <>
          {step === 1 && (
            <Step1ReviewConfirm
              change={change}
              accounts={accounts}
              selectedIds={selectedAccountIds}
              onToggle={toggleAccount}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2Materials
              changeTypeGroup={change.change_type_group}
              materials={materials}
              selectedIds={selectedMaterialIds}
              onToggle={toggleMaterial}
            />
          )}
          {step === 3 && (
            <Step3Communicate
              change={change}
              materials={selectedMaterials}
              recipients={selectedAccounts}
            />
          )}
        </>
      )}
    </Drawer>
  );
}

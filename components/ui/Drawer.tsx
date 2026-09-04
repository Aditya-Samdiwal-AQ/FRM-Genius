"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Drawer({
  open,
  onClose,
  header,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/30"
      />
      <div className="absolute inset-y-0 right-0 flex w-full min-w-[720px] max-w-[55vw] flex-col bg-[var(--surface)] shadow-2xl">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="border-t border-[var(--border)] bg-[var(--surface)]">
          {footer}
        </div>
      </div>
    </div>
  );
}

export function DrawerHeader({
  openCount,
  onClose,
}: {
  openCount: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-[var(--magenta)] px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="text-[16px] font-bold text-white">Payer Change</span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
          {openCount} open
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded p-1 text-white/90 hover:bg-white/10 hover:text-white"
      >
        <X size={20} aria-hidden />
      </button>
    </div>
  );
}

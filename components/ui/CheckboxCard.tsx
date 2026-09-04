"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function CheckboxCard({
  checked,
  onChange,
  title,
  subtitle,
  right,
}: {
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
        checked
          ? "border-[var(--indigo)] bg-[var(--surface)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          checked
            ? "border-[var(--indigo)] bg-[var(--indigo)] text-white"
            : "border-[var(--muted)] bg-white"
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-[var(--ink)]">
          {title}
        </span>
        {subtitle && <span className="provenance block">{subtitle}</span>}
      </span>
      {right}
    </label>
  );
}

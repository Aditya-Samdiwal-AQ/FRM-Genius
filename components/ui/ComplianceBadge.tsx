import { ShieldCheck } from "lucide-react";

export function ComplianceBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--green)] border-[var(--green-border)] bg-[var(--green-bg)] ${className}`}
    >
      <ShieldCheck size={11} strokeWidth={2.2} aria-hidden />
      COMPLIANCE-REVIEWED
    </span>
  );
}

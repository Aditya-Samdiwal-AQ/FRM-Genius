import type { ReactNode } from "react";

export function InfoBox({
  variant,
  children,
}: {
  variant: "green" | "gray" | "indigo" | "error";
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    green: "bg-[var(--green-bg)] border-[var(--green-border)]",
    gray: "bg-[var(--page-bg)] border-[var(--border)]",
    indigo: "bg-[var(--indigo-bg)] border-[var(--indigo)]",
    error: "bg-red-50 border-red-300",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${styles[variant]}`}>
      {children}
    </div>
  );
}

export function StatusPill({
  variant,
  count,
}: {
  variant: "resolved" | "open";
  count?: number;
}) {
  if (variant === "resolved") {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--green-border)] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--green)]">
        RESOLVED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--magenta-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
      {count} open
    </span>
  );
}

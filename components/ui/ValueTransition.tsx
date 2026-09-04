export function ValueTransition({
  old,
  current,
  tone,
}: {
  old: string;
  current: string;
  tone: "open" | "resolved";
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-snug">
      <span className="text-[var(--muted)] line-through">{old}</span>
      <span aria-hidden className="text-[var(--muted)]">
        →
      </span>
      <span
        className={`font-semibold ${
          tone === "resolved" ? "text-[var(--green)]" : "text-[var(--ink)]"
        }`}
      >
        {current}
      </span>
    </span>
  );
}

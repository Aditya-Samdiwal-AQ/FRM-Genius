import { Check } from "lucide-react";

const STEPS = ["Review & Confirm", "Materials", "Communicate"] as const;

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-0" aria-label="Resolution steps">
      {STEPS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`mx-3 h-px w-10 ${
                  done ? "bg-[var(--green-border)]" : "bg-[var(--border)]"
                }`}
              />
            )}
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                  done
                    ? "bg-[var(--green-border)] text-white"
                    : active
                      ? "bg-[var(--indigo)] text-white"
                      : "border border-[var(--border)] bg-white text-[var(--muted)]"
                }`}
              >
                {done ? <Check size={13} strokeWidth={3} /> : step}
              </span>
              <span
                className={`text-[13px] font-semibold ${
                  done
                    ? "text-[var(--green)]"
                    : active
                      ? "text-[var(--indigo)]"
                      : "text-[var(--muted)]"
                }`}
              >
                {label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

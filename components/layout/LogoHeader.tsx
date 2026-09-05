import { Zap } from "lucide-react";

export function LogoHeader() {
  return (
    <header className="bg-[var(--surface)]">
      <div aria-hidden className="h-[2px] w-full bg-[var(--magenta)]" />
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-4 sm:px-8">
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-[var(--magenta)] text-white shadow-lg shadow-pink-700/25">
          <Zap size={29} strokeWidth={2.5} aria-hidden />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[28px] font-extrabold leading-none text-[var(--ink)]">
            FRM <span className="text-[var(--magenta-soft)]">Genius</span>
          </span>
          <span className="mt-1 font-mono text-[14px] text-[var(--muted)]">
            <strong className="font-bold text-[var(--magenta)]">From Conflict to Clarity</strong>
          </span>
        </div>
      </div>
    </header>
  );
}

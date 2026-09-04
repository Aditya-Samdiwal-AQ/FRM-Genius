import { Gem } from "lucide-react";
import { PRODUCT_SUB } from "@/data/synthetic";

export function LogoHeader() {
  return (
    <header>
      <div aria-hidden className="h-[2px] w-full bg-[var(--magenta)]" />
      <div className="mx-auto flex max-w-[1440px] items-center gap-2.5 px-8 py-3">
        <Gem size={22} className="text-[var(--magenta)]" aria-hidden />
        <div className="leading-none">
          <span className="text-[18px] font-bold text-[var(--ink)]">Pharma</span>
          <span className="text-[18px] font-bold text-[var(--magenta)]">
            RX
          </span>
          <span className="ml-2 text-[11px] text-[var(--muted)]">
            {PRODUCT_SUB}
          </span>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FRM_NAME, FRM_TITLE } from "@/data/synthetic";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/payer-changes", label: "Payer Changes" },
  { href: "/accounts", label: "Accounts" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-[var(--nav-bg)]" aria-label="Primary">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 sm:px-8">
        <div className="flex items-stretch gap-2">
          {TABS.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative px-4 py-5 text-[14px] font-semibold transition-colors ${
                  active ? "text-white" : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {tab.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-[var(--magenta)]"
                  />
                )}
              </Link>
            );
          })}
        </div>
        <div className="py-3 text-right">
          <p className="provenance">{FRM_TITLE}</p>
          <p className="text-[14px] font-semibold text-white">{FRM_NAME}</p>
        </div>
      </div>
    </nav>
  );
}

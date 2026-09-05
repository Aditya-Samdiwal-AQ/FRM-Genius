"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function HomeEntryGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isHome] = useState(() => pathname === "/");

  useEffect(() => {
    const navEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const isReload =
      navEntry?.type === "reload" ||
      (typeof performance !== "undefined" &&
        "navigation" in performance &&
        (performance as Performance & { navigation?: { type?: number } })
          .navigation?.type === 1);

    if (!isHome && isReload) {
      window.location.replace("/");
    }
  }, [isHome, pathname]);

  return isHome ? children : null;
}

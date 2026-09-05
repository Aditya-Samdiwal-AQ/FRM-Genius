"use client";
 
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
 
export function HomeEntryGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isHome] = useState(() => pathname === "/");
 
  useEffect(() => {
    if (!isHome) {
      window.location.replace("/");
    }
  }, [isHome]);
 
  return isHome ? children : null;
}
 
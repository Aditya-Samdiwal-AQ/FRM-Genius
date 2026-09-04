import type { ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { LogoHeader } from "@/components/layout/LogoHeader";
import { FloatingHelp } from "@/components/ui/FloatingHelp";
import { DevPanel } from "@/components/layout/DevPanel";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <TopNav />
      <LogoHeader />
      {children}
      <FloatingHelp />
      <DevPanel />
    </>
  );
}

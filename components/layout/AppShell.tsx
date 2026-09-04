import type { ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { LogoHeader } from "@/components/layout/LogoHeader";
import { AssistantMount } from "@/features/assistant/AssistantMount";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <TopNav />
      <LogoHeader />
      {children}
      <AssistantMount />
    </>
  );
}

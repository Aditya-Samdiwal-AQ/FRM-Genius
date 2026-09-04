"use client";

// FRM Assistant — client mount point (Plan.md §11.2).
// Owns the open/close state so AppShell can stay a server component.

import { useState } from "react";
import { AssistantLauncher } from "./AssistantLauncher";
import { AssistantPanel } from "./AssistantPanel";

export function AssistantMount() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AssistantLauncher open={open} onToggle={() => setOpen((v) => !v)} />
      <AssistantPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

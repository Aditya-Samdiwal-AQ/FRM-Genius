"use client";

// FRM Assistant — magenta floating launcher (Plan.md §11.2 #1).
// 56×56 magenta circle, bottom-right, every screen. Chat glyph when closed,
// ✕ while open (image 3). Replaces FloatingHelp (§1.6 supersession note).

import { MessageCircle, X } from "lucide-react";

interface AssistantLauncherProps {
  open: boolean;
  onToggle: () => void;
}

export function AssistantLauncher({ open, onToggle }: AssistantLauncherProps) {
  return (
    <button
      type="button"
      aria-label={open ? "Close FRM Assistant" : "Open FRM Assistant"}
      aria-expanded={open}
      onClick={onToggle}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--magenta)] text-white shadow-lg transition-transform hover:scale-105 print:hidden"
    >
      {open ? <X size={24} aria-hidden /> : <MessageCircle size={24} aria-hidden />}
    </button>
  );
}

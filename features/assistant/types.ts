// FRM Assistant — shared types (Plan.md §11.2).

import type { FaqEntry } from "@/lib/faq";

export type { FaqEntry };

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  kind: "faq" | "agent" | "error";
  text: string;
  faqId?: string; // set when kind === "faq"
}

export type AssistantMode = "faq" | "chat";

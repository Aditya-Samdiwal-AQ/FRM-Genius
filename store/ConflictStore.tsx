"use client";

// ConflictStore — Plan.md §2.3 contract. Context + useReducer; deterministic seed.

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  SEED_CONFLICTS,
  type Conflict,
  type Material,
} from "@/data/synthetic";

export type ConflictState = {
  conflicts: Conflict[];
};

export type ConflictAction =
  | {
      type: "RESOLVE_CONFLICT";
      conflictId: string;
      accountIds: string[];
      materialIds: string[];
      message: string;
    }
  | { type: "RESET_DEMO" }
  | { type: "SIMULATE_MMIT_UPDATE" };

function seedState(): ConflictState {
  return { conflicts: SEED_CONFLICTS };
}

function reducer(state: ConflictState, action: ConflictAction): ConflictState {
  switch (action.type) {
    case "RESOLVE_CONFLICT": {
      const now = new Date();
      const resolvedAt = now.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return {
        ...state,
        conflicts: state.conflicts.map((c) => {
          if (c.id !== action.conflictId) return c;
          const materials: Material[] = c.materials.filter((m) =>
            action.materialIds.includes(m.id),
          );
          return {
            ...c,
            status: "resolved" as const,
            resolved_by: "Jordan Lee",
            resolved_at: resolvedAt,
            materials,
            notified_offices: action.accountIds.length,
            accounts: c.accounts.map((a) =>
              action.accountIds.includes(a.id)
                ? { ...a, resolved: true, notified: true }
                : a,
            ),
          };
        }),
      };
    }
    case "RESET_DEMO":
      return seedState();
    case "SIMULATE_MMIT_UPDATE":
      // Flips resolved rows back to open (demo trigger).
      return {
        ...state,
        conflicts: state.conflicts.map((c) =>
          c.status === "resolved"
            ? {
                ...c,
                status: "open" as const,
                resolved_by: undefined,
                resolved_at: undefined,
                notified_offices: undefined,
                accounts: c.accounts.map((a) => ({
                  ...a,
                  resolved: false,
                  notified: false,
                })),
              }
            : c,
        ),
      };
    default:
      return state;
  }
}

const ConflictStateContext = createContext<ConflictState | null>(null);
const ConflictDispatchContext = createContext<
  React.Dispatch<ConflictAction> | null
>(null);

export function ConflictStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);
  const stateValue = useMemo(() => state, [state]);
  return (
    <ConflictStateContext.Provider value={stateValue}>
      <ConflictDispatchContext.Provider value={dispatch}>
        {children}
      </ConflictDispatchContext.Provider>
    </ConflictStateContext.Provider>
  );
}

export function useConflictState(): ConflictState {
  const ctx = useContext(ConflictStateContext);
  if (!ctx) throw new Error("useConflictState must be used inside provider");
  return ctx;
}

export function useConflictDispatch(): React.Dispatch<ConflictAction> {
  const ctx = useContext(ConflictDispatchContext);
  if (!ctx) throw new Error("useConflictDispatch must be used inside provider");
  return ctx;
}

// Selectors (derived, never hardcoded)
export function selectOpenCount(conflicts: Conflict[]): number {
  return conflicts.filter((c) => c.status === "open").length;
}

export function selectResolvedCount(conflicts: Conflict[]): number {
  return conflicts.filter((c) => c.status === "resolved").length;
}

export function selectResolvedConflicts(conflicts: Conflict[]): Conflict[] {
  // Newest first — new entries prepend on send.
  return conflicts
    .filter((c) => c.status === "resolved")
    .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""));
}

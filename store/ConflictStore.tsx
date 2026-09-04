"use client";

// ConflictStore — Plan.md §2.3 contract, now backed by the real API.
// Holds PayerChange[] fetched from GET /api/payer-changes?status=all;
// resolve/notify/reset call the backend endpoints and reconcile state.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { ChangeSource, PayerChange } from "@/lib/types";
import {
  getPayerChanges,
  notifyPayerChange,
  resetDemoData,
  resolvePayerChange,
  simulateMmitUpdate,
} from "@/services/api";

export type ConflictState = {
  conflicts: PayerChange[];
  loading: boolean;
  error: string | null;
};

export type ConflictAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; conflicts: PayerChange[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "UPSERT_CHANGE"; change: PayerChange }
  | { type: "RESET_START" };

function initialState(): ConflictState {
  return { conflicts: [], loading: true, error: null };
}

function reducer(state: ConflictState, action: ConflictAction): ConflictState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return { conflicts: action.conflicts, loading: false, error: null };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.error };
    case "UPSERT_CHANGE": {
      const exists = state.conflicts.some((c) => c.id === action.change.id);
      return {
        ...state,
        conflicts: exists
          ? state.conflicts.map((c) =>
              c.id === action.change.id ? action.change : c,
            )
          : [...state.conflicts, action.change],
      };
    }
    case "RESET_START":
      return { ...state, loading: true, error: null };
    default:
      return state;
  }
}

const ConflictStateContext = createContext<ConflictState | null>(null);
const ConflictActionsContext = createContext<{
  refresh: () => Promise<void>;
  resolveAndNotify: (args: {
    changeId: string;
    correctedPathSource: ChangeSource;
    correctedPathValue: string;
    materialIds: string[];
  }) => Promise<void>;
  resetDemo: () => Promise<void>;
  simulateMmitUpdate: () => Promise<void>;
} | null>(null);

export function ConflictStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const actions: NonNullable<
    typeof ConflictActionsContext extends React.Context<infer T> ? T : never
  > = useMemo(
    () => ({
      async refresh() {
        dispatch({ type: "LOAD_START" });
        try {
          // status=all so the UI can render both open and resolved sections.
          const res = await getPayerChanges("all");
          const conflicts = res.groups.flatMap((g) => g.changes);
          dispatch({ type: "LOAD_SUCCESS", conflicts });
        } catch (error) {
          dispatch({
            type: "LOAD_ERROR",
            error:
              error instanceof Error ? error.message : "Failed to load changes.",
          });
        }
      },

      async resolveAndNotify({
        changeId,
        correctedPathSource,
        correctedPathValue,
        materialIds,
      }) {
        // 1. Resolve (sets status + corrected path + audit events).
        const { change } = await resolvePayerChange(changeId, {
          corrected_path_source: correctedPathSource,
          corrected_path_value: correctedPathValue,
        });
        // 2. Notify (sends email to affected accounts, persists Notification).
        await notifyPayerChange(changeId, materialIds);
        // 3. Reconcile the resolved change into local state.
        dispatch({ type: "UPSERT_CHANGE", change });
      },

      async resetDemo() {
        dispatch({ type: "RESET_START" });
        await resetDemoData();
        await actions.refresh();
      },

      async simulateMmitUpdate() {
        // Simulate a fresh MMIT data drop: re-run the diff engine against the
        // live DB, then reload so any new/updated conflicts appear.
        await simulateMmitUpdate();
        await actions.refresh();
      },
    }),
    [],
  );

  // Initial fetch on mount.
  useEffect(() => {
    void actions.refresh();
  }, [actions]);

  return (
    <ConflictStateContext.Provider value={state}>
      <ConflictActionsContext.Provider value={actions}>
        {children}
      </ConflictActionsContext.Provider>
    </ConflictStateContext.Provider>
  );
}

export function useConflictState(): ConflictState {
  const ctx = useContext(ConflictStateContext);
  if (!ctx) throw new Error("useConflictState must be used inside provider");
  return ctx;
}

export function useConflictActions() {
  const ctx = useContext(ConflictActionsContext);
  if (!ctx) throw new Error("useConflictActions must be used inside provider");
  return ctx;
}

// Selectors (derived, never hardcoded)
export function selectOpenCount(conflicts: PayerChange[]): number {
  return conflicts.filter((c) => c.status === "open").length;
}

export function selectResolvedCount(conflicts: PayerChange[]): number {
  return conflicts.filter((c) => c.status === "resolved").length;
}

export function selectResolvedConflicts(
  conflicts: PayerChange[],
): PayerChange[] {
  // Newest first by resolved_at.
  return conflicts
    .filter((c) => c.status === "resolved")
    .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""));
}

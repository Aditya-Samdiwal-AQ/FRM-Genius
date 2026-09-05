"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ArrowDown,
  ArrowUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { comparePriorityDesc } from "@/lib/priority";
import { FIELD_LABEL } from "@/lib/types";
import type { Account, ChangeType } from "@/lib/types";
import {
  getAccounts,
  getPayerChanges,
  logCase,
  type PrioritizedPayerChange,
} from "@/services/api";

type Case = {
  changeId: string;
  account: string;
  location: string;
  plan: string;
  issue: string;
  days: number;
  status: string;
  suggestion: string;
};

const ISSUE_OPTIONS = Object.entries(FIELD_LABEL) as [ChangeType, string][];

const STATUS_OPTIONS = ["Needs FRM action", "In progress", "Awaiting payer", "Resolved"] as const;
type CaseSortField = "account" | "plan" | "issue" | "days";
type SortDirection = "ascending" | "descending";

function DashboardSection({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left">
        <span className="flex items-center gap-2.5 text-[14px] font-bold"><ChevronDown size={18} className={`transition-transform ${open ? "" : "-rotate-90"}`} />{title}</span>
        <span className="eyebrow text-[var(--magenta)]">{meta}</span>
      </button>
      {open && <div className="border-t border-[var(--border)]">{children}</div>}
    </section>
  );
}

function SortButtons({
  field,
  activeField,
  direction,
  onSort,
}: {
  field: CaseSortField;
  activeField: CaseSortField;
  direction: SortDirection;
  onSort: (field: CaseSortField, direction: SortDirection) => void;
}) {
  const label = field === "plan" ? "payer and plan" : field === "days" ? "days open" : field;
  return (
    <span className="flex items-center">
      <button type="button" title={`Sort ${label} ascending`} aria-label={`Sort ${label} ascending`} aria-pressed={activeField === field && direction === "ascending"} onClick={() => onSort(field, "ascending")} className={`rounded p-0.5 hover:bg-[var(--page-bg)] ${activeField === field && direction === "ascending" ? "text-[var(--magenta)]" : ""}`}><ArrowUp size={13} aria-hidden /></button>
      <button type="button" title={`Sort ${label} descending`} aria-label={`Sort ${label} descending`} aria-pressed={activeField === field && direction === "descending"} onClick={() => onSort(field, "descending")} className={`rounded p-0.5 hover:bg-[var(--page-bg)] ${activeField === field && direction === "descending" ? "text-[var(--magenta)]" : ""}`}><ArrowDown size={13} aria-hidden /></button>
    </span>
  );
}

export function HomeDashboard() {
  const router = useRouter();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [changes, setChanges] = useState<PrioritizedPayerChange[]>([]);
  const [locallyResolvedIds, setLocallyResolvedIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manualCases, setManualCases] = useState<Case[]>([]);
  const [addCaseOpen, setAddCaseOpen] = useState(false);
  const [formAccountId, setFormAccountId] = useState("");
  const [formIssue, setFormIssue] = useState<ChangeType | "">("");
  const [formStatus, setFormStatus] = useState<string>(STATUS_OPTIONS[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sortField, setSortField] = useState<CaseSortField>("days");
  const [sortDirection, setSortDirection] = useState<SortDirection>("descending");

  useEffect(() => {
    let active = true;
    void Promise.all([getAccounts(), getPayerChanges("all")])
      .then(([accountResponse, changeResponse]) => {
        if (!active) return;
        setAccounts(accountResponse.accounts);
        setChanges(changeResponse.groups.flatMap((group) => group.changes));
      })
      .catch(() => {
        if (active) setLoadError("Live dashboard data could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const openChanges = changes.filter(
    (change) => change.status === "open" && !locallyResolvedIds.includes(change.id),
  );
  // §5.5: the API attaches priority (lives + affected accounts) but returns
  // rows grouped by change type; re-sort globally so the top 5 are truly the
  // five highest-priority conflicts, not the first five by group order.
  const majorPolicyChanges = [...openChanges]
    .sort(comparePriorityDesc)
    .slice(0, 5);
  const affectedAccountIds = new Set(
    openChanges.flatMap((change) => change.affected_account_ids),
  );
  const cases: Case[] = openChanges.flatMap((change) =>
    accounts
      .filter((account) => change.affected_account_ids.includes(account.id))
      .map((account) => ({
        changeId: change.id,
        account: account.name,
        location: `${account.territory} · ${account.hcp_specialty}`,
        plan: `${change.payer_name} · ${change.plan_name}`,
        issue: FIELD_LABEL[change.field],
        days: Math.max(0, Math.floor((Date.now() - Date.parse(change.detected_at)) / 86_400_000)),
        status: "Needs FRM action",
        suggestion: `Review the updated ${FIELD_LABEL[change.field].toLowerCase()} and confirm the corrected path with ${account.name}.`,
      })),
  );
  const sortedCases = [...manualCases, ...cases].sort((left, right) => {
    const leftValue = sortField === "days" ? left.days : left[sortField];
    const rightValue = sortField === "days" ? right.days : right[sortField];
    const comparison =
      typeof leftValue === "number"
        ? leftValue - (rightValue as number)
        : leftValue.localeCompare(rightValue as string);
    return (
      comparison * (sortDirection === "ascending" ? 1 : -1) ||
      left.account.localeCompare(right.account)
    );
  });
  const openConflicts = openChanges.length;
  const affectedAccounts = affectedAccountIds.size;
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const selectedAccount = accounts.find((a) => a.id === formAccountId) ?? null;

  const handleLogCase = async () => {
    if (!selectedAccount || !formIssue) {
      setFormError("Select an account and an issue.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      // Status stays client-side; the backend resolves the snapshot as-of date.
      const { case: logged } = await logCase({
        account_id: selectedAccount.id,
        payer_name: selectedAccount.payer_name,
        plan_id: selectedAccount.primary_plan_id,
        issue: formIssue,
      });
      const days = Math.max(
        0,
        Math.floor((Date.now() - Date.parse(logged.as_of_date)) / 86_400_000),
      );
      const row: Case = {
        changeId: logged.id,
        account: logged.account_name,
        location: `${logged.territory} · ${logged.hcp_specialty}`,
        plan: `${logged.payer_name} · ${logged.plan_name}`,
        issue: logged.issue_label,
        days,
        status: formStatus,
        suggestion: `Inbound call logged against the ${logged.as_of_date} snapshot. Review the updated ${logged.issue_label.toLowerCase()} and confirm the corrected path with ${logged.account_name}.`,
      };
      setManualCases((current) => [row, ...current]);
      setAddCaseOpen(false);
      setFormAccountId("");
      setFormIssue("");
      setFormStatus(STATUS_OPTIONS[0]);
      notify(`Case logged for ${row.account} — ${row.days} days open (as of ${logged.as_of_date})`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not log the case.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8">
        <section className={`card border-t-4 p-7 ${openConflicts === 0 ? "border-[var(--green-border)]" : "border-[var(--magenta)]"}`} aria-label="Territory health">
          <header className="mb-6 border-b border-[var(--border)] pb-5">
            <p className="provenance uppercase">T-NE-04</p>
            <h1 className="mt-1 text-[30px] font-bold">Good morning, Jordan</h1>
            <p className="mt-1 text-[15px] text-[var(--muted)]">Here is the state of your territory&apos;s payer guidance.</p>
          </header>
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.35fr]">
            <div>
              <p className={`text-[64px] leading-none font-extrabold ${openConflicts === 0 ? "text-[var(--green)]" : "text-[var(--magenta)]"}`}>{openConflicts}</p>
              <p className="mt-1.5 text-[15px] font-semibold">open plan conflicts</p>
              <p className="provenance mt-3">Across {openConflicts} plans · Live data from policy records</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 sm:divide-x sm:divide-[var(--border)]">
              {[[String(accounts.length), 'accounts in territory'], [String(affectedAccounts), 'accounts affected'], [`${changes.filter((change) => change.status === "resolved").length} of ${changes.length}`, 'conflicts resolved']].map(([value, label]) => <div key={label} className="sm:px-5 first:pl-0"><p className="text-[28px] font-extrabold">{value}</p><p className="text-[12px] text-[var(--muted)]">{label}</p></div>)}
            </div>
          </div>
          <div className={`mt-6 flex items-start gap-3 rounded-lg px-4 py-3 text-[14px] font-semibold ${openConflicts === 0 ? "bg-[var(--green-bg)] text-[var(--green)]" : "bg-[var(--page-bg)] text-[var(--magenta)]"}`} role="status">
            {openConflicts === 0 ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
            <span>{openConflicts === 0 ? "All plan conflicts resolved. Every account is guided by authoritative policy." : `${affectedAccounts} accounts are currently guided by superseded policy.`}</span>
            {openConflicts > 0 && <span className="ml-auto hidden text-right sm:block">Resolving at territory level takes one action.</span>}
          </div>
        </section>

        <div className="mt-4 space-y-4">
          <DashboardSection title="Major Policy Changes" meta={`Top ${majorPolicyChanges.length} of ${openChanges.length} by priority`}>
            {majorPolicyChanges.map((change) => <div key={change.id} className="flex flex-col justify-between gap-4 px-6 py-4 md:flex-row md:items-start [&+&]:border-t [&+&]:border-[var(--border)]">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[14px] font-bold">{change.payer_name} - {change.plan_name}</h2><span className="rounded bg-[var(--magenta-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">Conflict</span></div><div className="mt-2 flex flex-wrap gap-1.5">{[FIELD_LABEL[change.field], `Effective ${change.effective_date}`, change.channel, `${change.priority.lives.toLocaleString("en-US")} lives`].map((item) => <span key={item} className="rounded bg-[#f3f4f6] px-2 py-0.5 font-mono text-[11px] text-[var(--muted)]">{item}</span>)}</div></div>
              <div className="flex items-center gap-4"><span className="text-[12px] text-[var(--muted)]">{change.affected_account_ids.length} accounts affected</span><button type="button" onClick={() => router.push(`/payer-changes?reviewPlan=${encodeURIComponent(change.plan_id)}`)} className="rounded-lg border border-[var(--indigo)] px-4 py-1.5 text-[13px] font-semibold text-[var(--indigo)] hover:bg-[var(--indigo-bg)]">Review</button></div>
            </div>)}
          </DashboardSection>

          <DashboardSection title="Open Cases" meta={`${cases.length + manualCases.length} open`}>
            <div className="flex justify-end border-b border-[var(--border)] px-6 py-3">
              <button type="button" onClick={() => { setAddCaseOpen((open) => !open); setFormError(null); }} aria-expanded={addCaseOpen} className="rounded-lg bg-[var(--indigo)] px-4 py-1.5 text-[13px] font-semibold text-white hover:opacity-90">
                {addCaseOpen ? "Cancel" : "+ Log call"}
              </button>
            </div>
            {addCaseOpen && (
              <form onSubmit={(event) => { event.preventDefault(); void handleLogCase(); }} className="grid gap-3 border-b border-[var(--border)] bg-[var(--page-bg)] px-6 py-4 md:grid-cols-5">
                <label className="grid gap-1 text-[12px] font-semibold"><span>Account</span>
                  <select value={formAccountId} onChange={(event) => { setFormAccountId(event.target.value); setFormError(null); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-[13px] font-normal">
                    <option value="">Select account…</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[12px] font-semibold"><span>Payer</span>
                  <input readOnly value={selectedAccount?.payer_name ?? ""} placeholder="—" className="rounded-lg border border-[var(--border)] bg-[#f9fafb] px-2.5 py-2 text-[13px] font-normal text-[var(--muted)]" />
                </label>
                <label className="grid gap-1 text-[12px] font-semibold"><span>Plan</span>
                  <input readOnly value={selectedAccount?.primary_plan_name ?? ""} placeholder="—" className="rounded-lg border border-[var(--border)] bg-[#f9fafb] px-2.5 py-2 text-[13px] font-normal text-[var(--muted)]" />
                </label>
                <label className="grid gap-1 text-[12px] font-semibold"><span>Issue</span>
                  <select value={formIssue} onChange={(event) => { setFormIssue(event.target.value as ChangeType | ""); setFormError(null); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-[13px] font-normal">
                    <option value="">Select issue…</option>
                    {ISSUE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[12px] font-semibold"><span>Status</span>
                  <select value={formStatus} onChange={(event) => setFormStatus(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-[13px] font-normal">
                    {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <div className="flex items-center gap-3 md:col-span-5">
                  <button type="submit" disabled={submitting || !selectedAccount || !formIssue} className="rounded-lg bg-[var(--green)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{submitting ? "Logging…" : "Log case"}</button>
                  {formError && <p className="text-[12px] text-red-700">{formError}</p>}
                </div>
              </form>
            )}
            <div className="min-w-0 max-w-full overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="border-b border-[var(--border)]"><tr>{([ ["Account", "account"], ["Payer · Plan", "plan"], ["Issue", "issue"], ["Days Open", "days"] ] as const).map(([heading, field]) => <th key={field} className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"><span className="flex items-center gap-1.5">{heading}<SortButtons field={field} activeField={sortField} direction={sortDirection} onSort={(nextField, nextDirection) => { setSortField(nextField); setSortDirection(nextDirection); }} /></span></th>)}<th className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Status</th><th className="px-6 py-3.5" /></tr></thead><tbody>{sortedCases.map((row) => <tr key={row.changeId + row.account} className="border-b border-[var(--border)] last:border-0"><td className="px-6 py-3.5"><p className="text-[14px] font-bold">{row.account}</p><p className="mt-0.5 text-[12px] text-[var(--muted)]">{row.location}</p></td><td className="px-6 py-3.5 text-[13px]">{row.plan}</td><td className="px-6 py-3.5 text-[13px]">{row.issue}</td><td className={`px-6 py-3.5 text-[14px] font-bold ${row.days > 14 ? "text-red-600" : row.days > 7 ? "text-orange-600" : ""}`}>{row.days}d</td><td className="px-6 py-3.5 text-[12px] text-[var(--muted)]">{row.status}</td><td className="px-6 py-3.5 text-right"><button type="button" onClick={() => setSelectedCase(row)} className="rounded-lg border border-[var(--indigo)] px-4 py-1.5 text-[13px] font-semibold text-[var(--indigo)] hover:bg-[var(--indigo-bg)]">View</button></td></tr>)}</tbody></table></div>
          </DashboardSection>
        </div>
        {loadError && <p className="mt-4 text-[13px] text-red-700">{loadError}</p>}
      </main>

      <div className="fixed bottom-6 left-6 z-20 hidden items-center gap-3 rounded-lg bg-[var(--nav-bg)] p-3 shadow-lg sm:flex"><span className="eyebrow text-gray-400">Demo</span><button type="button" onClick={() => { setLocallyResolvedIds([]); notify("Dashboard view reset"); }} className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[12px] font-semibold text-zinc-200">Reset demo</button></div>

      {selectedCase && <><button type="button" aria-label="Close case detail" className="fixed inset-0 z-30 bg-black/45" onClick={() => setSelectedCase(null)} /><aside role="dialog" aria-modal="true" aria-label="Case detail" className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[460px] flex-col bg-white shadow-2xl"><header className="flex items-center justify-between bg-[var(--magenta)] px-5 py-3.5 text-white"><h2 className="text-[14px] font-bold">Case Detail</h2><button type="button" aria-label="Close case detail" onClick={() => setSelectedCase(null)}><X size={20} /></button></header><div className="flex-1 overflow-y-auto p-5"><h3 className="text-[18px] font-bold">{selectedCase.account}</h3><p className="mt-0.5 text-[13px] text-[var(--muted)]">{selectedCase.location}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded border border-[var(--border)] px-2 py-1 font-mono text-[11px]">{selectedCase.plan}</span><span className="rounded bg-[#f3f4f6] px-2 py-1 text-[10px] font-bold uppercase">{selectedCase.status}</span><span className="rounded bg-red-50 px-2 py-1 font-mono text-[11px] text-red-600">{selectedCase.days} days open</span></div><p className="eyebrow mt-6">Barrier to Therapy</p><div className="mt-2 rounded-lg bg-orange-50 p-4"><p className="text-[12px] font-bold uppercase text-orange-600">{selectedCase.issue}</p><p className="mt-2 text-[13px]">Onvexa · {selectedCase.plan} · Review required</p></div><p className="eyebrow mt-6">System Suggestion</p><div className="mt-2 rounded-lg bg-[var(--indigo-bg)] p-4"><div className="flex items-center gap-2"><p className="text-[12px] font-bold uppercase text-[var(--indigo)]">Suggested next action</p><span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--green)]">Compliance-reviewed</span></div><p className="mt-2 text-[13px] leading-5">{selectedCase.suggestion}</p></div></div><footer className="grid grid-cols-2 gap-2 border-t border-[var(--border)] p-4"><button type="button" onClick={() => notify(`Action logged for ${selectedCase.account}`)} className="rounded-lg border border-[var(--border)] py-2 text-[12px] font-semibold">Log action</button><button type="button" onClick={() => { setSelectedCase(null); setLocallyResolvedIds((ids) => [...ids, selectedCase.changeId]); setManualCases((rows) => rows.filter((row) => row.changeId !== selectedCase.changeId)); notify(`${selectedCase.account} marked resolved`); }} className="rounded-lg bg-[var(--green)] py-2 text-[12px] font-semibold text-white">Mark resolved</button></footer></aside></>}
      {toast && <div role="status" className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[13px] font-medium text-white shadow-xl">{toast}</div>}
    </AppShell>
  );
}
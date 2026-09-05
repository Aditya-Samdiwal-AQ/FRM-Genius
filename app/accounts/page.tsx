"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PRODUCT } from "@/data/synthetic";
import { FIELD_LABEL } from "@/lib/types";
import type { Account, PayerChange } from "@/lib/types";
import { getAccounts, getPayerChanges } from "@/services/api";

type AccountSortField =
  | "account"
  | "channel"
  | "plan"
  | "zip"
  | "conflict";
type SortDirection = "ascending" | "descending";

function SortButtons({
  field,
  activeField,
  direction,
  onSort,
}: {
  field: AccountSortField;
  activeField: AccountSortField;
  direction: SortDirection;
  onSort: (field: AccountSortField, direction: SortDirection) => void;
}) {
  return (
    <span className="flex items-center">
      <button type="button" title={`Sort ${field} ascending`} aria-label={`Sort ${field} ascending`} aria-pressed={activeField === field && direction === "ascending"} onClick={() => onSort(field, "ascending")} className={`rounded p-0.5 hover:bg-[var(--page-bg)] ${activeField === field && direction === "ascending" ? "text-[var(--magenta)]" : ""}`}><ArrowUp size={13} aria-hidden /></button>
      <button type="button" title={`Sort ${field} descending`} aria-label={`Sort ${field} descending`} aria-pressed={activeField === field && direction === "descending"} onClick={() => onSort(field, "descending")} className={`rounded p-0.5 hover:bg-[var(--page-bg)] ${activeField === field && direction === "descending" ? "text-[var(--magenta)]" : ""}`}><ArrowDown size={13} aria-hidden /></button>
    </span>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [conflicts, setConflicts] = useState<PayerChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<AccountSortField>("account");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");

  useEffect(() => {
    let active = true;
    void Promise.all([getAccounts(), getPayerChanges("open")])
      .then(([accountResponse, changeResponse]) => {
        if (!active) return;
        setAccounts(accountResponse.accounts);
        setConflicts(changeResponse.groups.flatMap((group) => group.changes));
      })
      .catch(() => {
        if (active) setError("Accounts could not be loaded. Please try again.");
      });
    return () => {
      active = false;
    };
  }, []);

  const conflictTypes = (accountId: string) =>
    conflicts
      .filter((change) => change.affected_account_ids.includes(accountId))
      .map((change) => FIELD_LABEL[change.field])
      .filter((label, index, labels) => labels.indexOf(label) === index);
  const territory = accounts[0]?.territory ?? "Territory";

  const sortedAccounts = [...accounts].sort((left, right) => {
    const leftConflict = conflictTypes(left.id).join(" · ");
    const rightConflict = conflictTypes(right.id).join(" · ");
    const leftValue =
      sortField === "account" ? left.name :
      sortField === "plan" ? `${left.payer_name} ${left.primary_plan_name}` :
      sortField === "zip" ? left.zip_code :
      sortField === "conflict" ? leftConflict : left[sortField];
    const rightValue =
      sortField === "account" ? right.name :
      sortField === "plan" ? `${right.payer_name} ${right.primary_plan_name}` :
      sortField === "zip" ? right.zip_code :
      sortField === "conflict" ? rightConflict : right[sortField];
    const comparison = leftValue.localeCompare(rightValue);
    return comparison * (sortDirection === "ascending" ? 1 : -1) || left.name.localeCompare(right.name);
  });

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8">
        <section className="card overflow-hidden" aria-label="Accounts">
          <header className="px-6 pb-4 pt-5">
            <h1 className="text-[18px] font-bold text-[var(--ink)]">
              Territory: {territory}
            </h1>
            <p className="provenance mt-1">{PRODUCT} · {accounts.length} accounts</p>
          </header>

          {error ? (
            <p className="border-t border-[var(--border)] px-6 py-4 text-[13px] text-red-700">
              {error}
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left">
                <thead className="border-l-4 border-l-[var(--magenta)] bg-[var(--magenta)] text-white">
                  <tr>
                    {([ ["Account", "account"], ["Channel", "channel"], ["Payer · Plan", "plan"], ["Zip Code", "zip"], ["Conflict type", "conflict"] ] as const).map(([heading, field]) => (
                      <th key={field} className="px-6 py-3.5 text-[13px] font-semibold">
                        <span className="flex items-center gap-1.5">{heading}<SortButtons field={field} activeField={sortField} direction={sortDirection} onSort={(nextField, nextDirection) => { setSortField(nextField); setSortDirection(nextDirection); }} /></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map((account) => {
                    const types = conflictTypes(account.id);
                    const hasConflict = types.length > 0;
                    return (
                      <tr
                        key={account.id}
                        className={`border-b border-[var(--border)] last:border-b-0 ${
                          hasConflict ? "border-l-4 border-l-red-600" : "border-l-4 border-l-green-600"
                        }`}
                      >
                        <td className="px-6 py-4 text-[14px] font-semibold">{account.name}</td>
                        <td className="px-6 py-4 text-[13px]">{account.channel}</td>
                        <td className="px-6 py-4 text-[13px]">
                          {account.payer_name} <span className="text-[var(--muted)]">{account.primary_plan_name}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-[12px]">{account.zip_code}</td>
                        <td className={`px-6 py-4 text-[13px] ${hasConflict ? "font-medium text-red-600" : "font-medium text-green-600"}`}>
                          {hasConflict ? types.join(" · ") : "No open conflict"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}

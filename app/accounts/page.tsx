"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { FIELD_LABEL } from "@/lib/types";
import type { Account, PayerChange } from "@/lib/types";
import { getAccounts, getPayerChanges } from "@/services/api";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [conflicts, setConflicts] = useState<PayerChange[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8">
        <section className="card overflow-hidden" aria-label="Accounts">
          <header className="px-6 pb-4 pt-5">
            <h1 className="text-[18px] font-bold text-[var(--ink)]">
              Territory 14 - Great Lakes
            </h1>
            <p className="provenance mt-1">Onvexa · {accounts.length} accounts</p>
          </header>

          {error ? (
            <p className="border-t border-[var(--border)] px-6 py-4 text-[13px] text-red-700">
              {error}
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="bg-[var(--magenta)] text-white">
                  <tr>
                    {["Account", "Channel", "Payer · Plan", "Territory", "Conflict type"].map((heading) => (
                      <th key={heading} className="px-6 py-3.5 text-[13px] font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => {
                    const types = conflictTypes(account.id);
                    const hasConflict = types.length > 0;
                    return (
                      <tr
                        key={account.id}
                        className={`border-b border-[var(--border)] last:border-0 ${
                          hasConflict ? "border-l-4 border-l-red-600" : "border-l-4 border-l-transparent"
                        }`}
                      >
                        <td className="px-6 py-4 text-[14px] font-semibold">{account.name}</td>
                        <td className="px-6 py-4 text-[13px]">{account.channel}</td>
                        <td className="px-6 py-4 text-[13px]">
                          {account.payer_name} <span className="text-[var(--muted)]">{account.primary_plan_name}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-[12px]">{account.territory}</td>
                        <td className={`px-6 py-4 text-[13px] ${hasConflict ? "font-medium text-red-600" : "text-[var(--muted)]"}`}>
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

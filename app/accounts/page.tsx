import { AppShell } from "@/components/layout/AppShell";

export default function AccountsStub() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1440px] px-8 py-6">
        <section className="card p-6">
          <h1 className="text-[18px] font-bold text-[var(--ink)]">Accounts</h1>
          <p className="provenance mt-1">Stub — out of scope for demo.</p>
        </section>
      </main>
    </AppShell>
  );
}

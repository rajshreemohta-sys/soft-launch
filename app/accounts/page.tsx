import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getAccounts } from "@/lib/data";
import { AccountsTable, type AccountRow } from "./AccountsTable";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <>
      <section className="section" style={{ paddingBottom: 32 }}>
        <p className="eyebrow">All accounts</p>
        <h1 className="display">Forty accounts, one ranking</h1>
        <p className="lede">Sorted by signal score. Accounts with no signals in the last 30 days sit greyed at the bottom.</p>
      </section>
      <div className="rule" />
      <section className="section">
        <Suspense fallback={<p className="muted">Loading accounts…</p>}>
          <Accounts />
        </Suspense>
      </section>
    </>
  );
}

async function Accounts() {
  await connection();
  const accounts = await getAccounts();
  let rank = 0;
  const rows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    rank: Number(a.signal_score) > 0 ? ++rank : null,
    company: a.company_name,
    sector: a.sector,
    stage: a.deal_stage,
    score: Number(a.signal_score),
    signalType: a.latest_signal_type,
    signalDate: a.latest_signal_date,
    lastContact: a.last_contact_date,
  }));
  return <AccountsTable rows={rows} />;
}

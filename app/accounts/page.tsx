import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getAccounts, getProfileSummaries } from "@/lib/data";
import { AccountsTable, type AccountRow } from "./AccountsTable";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  return (
    <>
      <section className="page-head">
        <h1 className="page-title">Accounts</h1>
        <p className="muted small">Accounts with a trigger in the last 30 days, ranked by lead temperature. Quiet accounts are listed below with what we know about them.</p>
      </section>
      <div className="rule" />
      <section className="section">
        <Suspense fallback={<p className="muted">Loading accounts…</p>}>
          <Accounts searchParams={searchParams} />
        </Suspense>
      </section>
    </>
  );
}

async function Accounts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = await searchParams;
  const temp = typeof params.temp === "string" && ["hot", "warm", "cool", "cold"].includes(params.temp) ? params.temp : "all";
  const sort = params.sort === "recent" ? "recent" : "score";
  const [accounts, profiles] = await Promise.all([getAccounts(), getProfileSummaries()]);
  let rank = 0;
  const rows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    rank: Number(a.signal_score) > 0 ? ++rank : null,
    company: a.company_name,
    sector: a.sector,
    stage: a.deal_stage,
    score: Number(a.signal_score),
    signalType: a.latest_signal_type,
    signalSummary: a.latest_signal_summary,
    signalDate: a.latest_signal_date,
    lastContact: a.last_contact_date,
    revenue: profiles.get(a.id)?.revenue ?? null,
    leader: profiles.get(a.id)?.leader ?? null,
  }));
  return <AccountsTable key={`${temp}-${sort}`} rows={rows} initialTemp={temp} initialSort={sort} />;
}

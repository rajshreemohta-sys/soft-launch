import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Gauge, HeatMeter, SignalsPerDay, StageTemperature, TriggersByType } from "@/components/Charts";
import { SignalArt } from "@/components/Logo";
import { SignalTag, StageTag } from "@/components/Tag";
import { getDashboard } from "@/lib/dashboard";
import { DEAL_STAGE_LABELS } from "@/lib/format";
import { HEAT_BANDS, heatIndex } from "@/lib/heat";
import { HOT_LIST_WINDOW_DAYS, SITE } from "@/lib/site";

export default function HotListPage() {
  return (
    <>
      <section className="hero hero-compact">
        <div>
          <p className="eyebrow">Hot List</p>
          <h1 className="display">{SITE.headline}</h1>
          <p className="lede">
            40 accounts, read every morning. Fresh triggers heat a lead up; quiet accounts cool down on their own.
          </p>
        </div>
        <SignalArt />
      </section>
      <div className="rule" />
      <Suspense fallback={<section className="section"><p className="muted">Loading the dashboard…</p></section>}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  await connection();
  const { entries, bandCounts, hottest, newThisWeek, nextHotList, days, byType, stageRows } = await getDashboard();

  return (
    <>
      <section className="section section-tight">
        <div className="kpis">
          {HEAT_BANDS.map((b) => (
            <div key={b} className="kpi">
              <span className="kpi-label">
                <span className={`heat-dot heat-${b.toLowerCase()}`} aria-hidden="true" />
                {b} leads
              </span>
              <span className="kpi-value">{bandCounts[b]}</span>
            </div>
          ))}
          <div className="kpi">
            <span className="kpi-label">New triggers, last 7 days</span>
            <span className="kpi-value">{newThisWeek}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Next Hot List email</span>
            <span className="kpi-value kpi-small">{nextHotList}</span>
          </div>
        </div>
      </section>
      <div className="rule" />

      {hottest.length > 0 && (
        <>
          <section className="section">
            <h2 className="display section-title">Hottest right now</h2>
            <div className="gauges">
              {hottest.map(({ a, heat }) => (
                <Link key={a.id} href={`/accounts/${a.id}`} className="gauge-card">
                  <Gauge value={heat} label={a.company_name} sublabel={DEAL_STAGE_LABELS[a.deal_stage ?? ""] ?? ""} />
                </Link>
              ))}
            </div>
          </section>
          <div className="rule" />
        </>
      )}

      <section className="section">
        <div className="chart-grid">
          <div className="chart-card chart-wide">
            <h3 className="chart-title">New trigger events per day</h3>
            <p className="chart-sub">Last 14 days, all accounts</p>
            <div className="chart-scroll">
              <SignalsPerDay days={days} />
            </div>
          </div>
          <div className="chart-card">
            <h3 className="chart-title">What is triggering them</h3>
            <p className="chart-sub">Trigger events by type, last 30 days</p>
            <TriggersByType counts={byType} />
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Pipeline temperature</h3>
            <p className="chart-sub">Accounts by deal stage, hot to cold</p>
            <StageTemperature rows={stageRows} />
          </div>
        </div>
      </section>
      <div className="rule" />

      <section className="section">
        <div className="section-head">
          <h2 className="display section-title">This week&rsquo;s Hot List</h2>
          <p className="muted small">Fresh trigger in the last {HOT_LIST_WINDOW_DAYS} days, ranked by signal score.</p>
        </div>
        {entries.length ? (
          <ol className="leads">
            {entries.map(({ rank, account, signal }) => (
              <li key={account.id}>
                <Link href={`/accounts/${account.id}`} className="lead-row">
                  <span className="lead-rank">{String(rank).padStart(2, "0")}</span>
                  <span className="lead-name">
                    <strong>{account.company_name}</strong>
                    <StageTag stage={account.deal_stage} />
                  </span>
                  <HeatMeter value={heatIndex(Number(account.signal_score))} />
                  <span className="lead-tag"><SignalTag type={signal.signal_type} /></span>
                  <span className="lead-summary">{signal.summary}</span>
                  <span className="lead-cta">Open analysis</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty">
            <strong>No fresh signals in the last {HOT_LIST_WINDOW_DAYS} days.</strong>
            Run collection now to check again.
          </div>
        )}
      </section>
    </>
  );
}

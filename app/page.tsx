import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Carousel } from "@/components/Carousel";
import { TemperatureLadder } from "@/components/TemperatureLadder";
import { MiniGauge, SignalsPerDay, StageTemperature, TriggersByType, TYPE_COLOR } from "@/components/Charts";
import { SignalTag, StageTag } from "@/components/Tag";
import { getDashboard } from "@/lib/dashboard";
import { HEAT_BANDS, heatBand, heatIndex } from "@/lib/heat";
import type { SignalType } from "@/lib/taxonomy";
import { HOT_LIST_WINDOW_DAYS } from "@/lib/site";

export default function HotListPage() {
  return (
    <>
      <h1 className="sr-only">Hot List dashboard</h1>
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
      <section className="section section-tight section-first">
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
            <div className="section-head">
              <h2 className="display section-title">Hottest right now</h2>
              <p className="muted small">Top 8 by lead temperature. The marker shows where each sits from cold to hot.</p>
            </div>
            <TemperatureLadder
              rows={hottest.map(({ a, heat }) => ({ id: a.id, name: a.company_name, stage: a.deal_stage, heat, signalType: a.latest_signal_type }))}
            />
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
          <Carousel label="This week's Hot List">
            {entries.map(({ rank, account, signal }) => {
              const heat = heatIndex(Number(account.signal_score));
              const band = heatBand(heat);
              return (
                <Link key={account.id} href={`/accounts/${account.id}`} className="hot-box">
                  <span className="hot-strip" style={{ background: TYPE_COLOR[signal.signal_type as SignalType] }} aria-hidden="true" />
                  <span className="hot-top">
                    <span className="hot-rank">{String(rank).padStart(2, "0")}</span>
                    <MiniGauge value={heat} />
                  </span>
                  <span className="hot-name">{account.company_name}</span>
                  <span className="hot-pills">
                    <StageTag stage={account.deal_stage} />
                    <span className={`heat-chip heat-${band.toLowerCase()}`}>{band}</span>
                  </span>
                  <span className="hot-pills"><SignalTag type={signal.signal_type} /></span>
                  <span className="hot-summary">{signal.summary}</span>
                  <span className="hot-cta btn btn-sm btn-ghost">Open analysis</span>
                </Link>
              );
            })}
          </Carousel>
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

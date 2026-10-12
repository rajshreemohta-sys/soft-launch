import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Gauge, StockChart } from "@/components/Charts";
import { OutreachDrafts } from "@/components/OutreachDrafts";
import { Tabs } from "@/components/Tabs";
import { SignalTag, StageTag } from "@/components/Tag";
import { getAccount, getInsight, getProfile, type Signal } from "@/lib/data";
import { formatDate, formatDateLong, formatScore, hostname, shortWorkforce, sourceLabel } from "@/lib/format";
import { heatBand, heatIndex } from "@/lib/heat";
import { generateInsight, insightIsStale, type Insight } from "@/lib/insights";
import { getRecentNews, getStock } from "@/lib/live";
import { reportLink, type CompanyProfile, type Source } from "@/lib/profile";
import type { Account } from "@/lib/supabase";

export default function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  return (
    <Suspense fallback={<section className="section"><p className="muted">Loading the analysis…</p></section>}>
      <Analysis params={params} />
    </Suspense>
  );
}

async function Analysis({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const data = await getAccount(id);
  if (!data) notFound();
  const { account: a, signals } = data;
  const [profileRow, insightRow] = await Promise.all([getProfile(a.id), getInsight(a.id)]);
  const profile = profileRow?.profile ?? null;
  const sources = profileRow?.sources ?? [];

  // Refresh the AI read when a newer signal has arrived (or it is a week old).
  let insight: Insight | null = insightRow?.insight ?? null;
  if (insightIsStale(insightRow, a)) {
    try {
      insight = await generateInsight(a, profile);
    } catch {
      /* keep the previous read */
    }
  }

  const heat = heatIndex(Number(a.signal_score));
  const news = getRecentNews(a.search_terms); // started now, awaited inside its tab

  return (
    <>
      <section className="section account-head">
        <div>
          <Link href="/accounts" className="back">{"←"} All accounts</Link>
          <h1 className="display" style={{ marginTop: 16 }}>{a.company_name}</h1>
          <p className="facts-line">
            <span>{a.sector}</span>
            {profile?.nse_symbol && <span>{profile.listed ? "NSE" : "Parent on NSE"}: {profile.nse_symbol}</span>}
            {profile && !profile.listed && !profile.nse_symbol && <span>Private company</span>}
          </p>
          <div className="head-pills">
            <StageTag stage={a.deal_stage} />
            {a.hot_rank && <span className="stage">#{a.hot_rank} on the Hot List</span>}
            {signals[0] && <SignalTag type={signals[0].signal_type} />}
          </div>
        </div>
        <Gauge value={heat} size={200} label="Lead temperature" sublabel={`Signal score ${formatScore(a.signal_score)}`} />
      </section>

      <section className="section section-tight" style={{ paddingTop: 0 }}>
        <dl className="fact-strip">
          <div><dt>Founded</dt><dd>{profile?.founded_year ?? "—"}</dd></div>
          <div><dt>Headquarters</dt><dd>{profile?.headquarters ?? "—"}</dd></div>
          <div><dt>Workforce</dt><dd>{shortWorkforce(profile?.employees)}</dd></div>
          <div>
            <dt>Revenue{profile?.financials.fiscal_year ? ` (${shortFy(profile.financials.fiscal_year)})` : ""}</dt>
            <dd>{profile?.financials.revenue ?? "Not disclosed"}</dd>
          </div>
          <div>
            <dt>Share price</dt>
            <dd>
              {profile?.nse_symbol ? (
                <Suspense fallback={"…"}>
                  <PriceTile symbol={profile.nse_symbol} />
                </Suspense>
              ) : (
                "Not listed"
              )}
            </dd>
          </div>
        </dl>
      </section>
      <div className="rule" />

      <section className="section">
        <div className="account-body">
          <Tabs
            label={`${a.company_name} analysis`}
            tabs={[
              { id: "trigger", label: "Trigger", count: signals.length, content: <TriggerTab insight={insight} signals={signals} /> },
              { id: "analysis", label: "Signal analysis", content: <AnalysisTab insight={insight} a={a} /> },
              {
                id: "drafts",
                label: "Outreach drafts",
                content: insight ? (
                  <OutreachDrafts
                    company={a.company_name}
                    contactName={insight.best_contact.name}
                    contactTitle={insight.best_contact.title}
                    subject={insight.email.subject}
                    body={insight.email.body}
                    linkedinNote={insight.linkedin_note}
                  />
                ) : (
                  <p className="muted">Drafts are being prepared. Refresh in a minute.</p>
                ),
              },
              {
                id: "news",
                label: "Recent news",
                content: (
                  <Suspense fallback={<p className="muted small">Fetching the latest headlines…</p>}>
                    <NewsTab news={news} />
                  </Suspense>
                ),
              },
              { id: "company", label: "Company", content: <CompanyTab profile={profile} sources={sources} company={a.company_name} refreshedAt={profileRow?.refreshed_at} /> },
            ]}
          />

          <aside className="panel panel-arjun account-notes" aria-labelledby="arjun-h">
            <h2 id="arjun-h" className="card-title">Arjun&rsquo;s notes</h2>
            <p className="panel-note">Arjun owns this panel. The system never edits it.</p>
            <dl className="facts">
              <div><dt>Deal stage</dt><dd><StageTag stage={a.deal_stage} /></dd></div>
              <div><dt>Notes</dt><dd>{a.arjun_notes || "—"}</dd></div>
              <div><dt>Last contact</dt><dd>{formatDateLong(a.last_contact_date)}</dd></div>
              <div><dt>Relationship read</dt><dd>{a.relationship_read || "—"}</dd></div>
            </dl>
          </aside>
        </div>
      </section>
    </>
  );
}

// "FY 2025–26 (ended March 31, 2026)" -> "FY 2025–26"
function shortFy(fy: string): string {
  return fy.replace(/\s*\(.*\)\s*/, "").trim();
}

// ---------------------------------------------------------------- tabs

function TriggerTab({ insight, signals }: { insight: Insight | null; signals: Signal[] }) {
  if (!signals.length) {
    return <p className="muted">No trigger events found yet. This account stays cold until news appears.</p>;
  }
  return (
    <div className="tab-stack">
      {insight && (
        <div className="callout">
          <span className="callout-label">Why now</span>
          <p>{insight.why_now}</p>
        </div>
      )}
      <ol className="trigger-list">
        {signals.map((s) => (
          <li key={s.id}>
            <div className="trigger-meta">
              <span className="trigger-date">{formatDate(s.published_at)}</span>
              <SignalTag type={s.signal_type} />
              <span className="strength" title={`Strength ${s.strength} of 10`}>
                <span className="strength-bar"><span style={{ width: `${s.strength * 10}%` }} /></span>
                {s.strength}/10
              </span>
            </div>
            <p className="trigger-summary">{s.summary}</p>
            {s.reasoning && <p className="small muted">{s.reasoning}</p>}
            <a className="small" href={s.source_url} target="_blank" rel="noopener noreferrer">
              {sourceLabel(s.source_name, s.source_url)}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AnalysisTab({ insight, a }: { insight: Insight | null; a: Account }) {
  if (!insight) return <p className="muted">The signal analysis is being prepared. Refresh in a minute.</p>;
  const band = heatBand(heatIndex(Number(a.signal_score)));
  return (
    <div className="tab-stack">
      <div className="callout">
        <span className="callout-label">
          <span className={`heat-chip heat-${band.toLowerCase()}`}>{band}</span> Verdict
        </span>
        <p>{insight.verdict}</p>
      </div>
      {a.outreach_angle && (
        <div className="callout callout-plain">
          <span className="callout-label">Hot List outreach angle</span>
          <p>{a.outreach_angle}</p>
        </div>
      )}
      <div className="analysis-grid">
        <section>
          <h3>How to approach</h3>
          <ol>{insight.approach.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
        <section>
          <h3>Talking points</h3>
          <ul>{insight.talking_points.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
        <section>
          <h3>Contact first</h3>
          <p>
            <strong>{insight.best_contact.name ?? insight.best_contact.title}</strong>
            {insight.best_contact.name && <span className="muted">, {insight.best_contact.title}</span>}
          </p>
          <p className="small muted" style={{ marginTop: 6 }}>{insight.best_contact.why}</p>
        </section>
        <section>
          <h3>Be ready for</h3>
          <ul>{insight.risks.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
      </div>
      <p className="small muted">Written by Gemini Flash from the trigger events, company facts and Arjun&rsquo;s notes.</p>
    </div>
  );
}

async function NewsTab({ news }: { news: ReturnType<typeof getRecentNews> }) {
  const items = await news;
  if (!items.length) return <p className="muted">No coverage in the last 14 days.</p>;
  return (
    <ul className="news">
      {items.map((n) => (
        <li key={n.url}>
          <span className="news-date">{formatDate(n.publishedAt)}</span>
          <span>
            <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
            <span className="small muted"> · {sourceLabel(n.source, n.url)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CompanyTab({ profile, sources, company, refreshedAt }: { profile: CompanyProfile | null; sources: Source[]; company: string; refreshedAt?: string }) {
  if (!profile) return <p className="muted">Company research is still running for this account.</p>;
  const f = profile.financials;
  const report = reportLink(sources);
  return (
    <div className="tab-stack">
      <p>{profile.business_summary}</p>
      <div className="company-grid">
        <section className="mini-card">
          <h3>Financials{f.fiscal_year ? <span className="muted"> · {shortFy(f.fiscal_year)}</span> : null}</h3>
          <dl className="facts facts-grid">
            <div><dt>Revenue</dt><dd>{f.revenue ?? "Not disclosed"}</dd></div>
            <div><dt>Net profit</dt><dd>{f.net_profit ?? "Not disclosed"}</dd></div>
          </dl>
          {f.note && <p className="small muted" style={{ marginTop: 10 }}>{f.note}</p>}
          {report ? (
            <a className="btn btn-sm btn-primary report-btn" href={report.url} target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 1.5h5.5L13 5v9.5H4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M9.5 1.5V5H13M6 8.5h5M6 11h5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {/\.pdf/i.test(report.url) ? "Annual report (PDF)" : "Investor relations"}
            </a>
          ) : (
            <p className="small muted" style={{ marginTop: 10 }}>
              {profile.listed || profile.nse_symbol ? "No annual report link in the research sources." : "Private company: no public balance sheet. Figures are from filings reported in the news."}
            </p>
          )}
        </section>

        {profile.nse_symbol && (
          <section className="mini-card">
            <h3>Share price<span className="muted"> · {profile.listed ? "" : "listed parent, "}NSE: {profile.nse_symbol}</span></h3>
            <Suspense fallback={<p className="muted small">Loading the price…</p>}>
              <StockPanel symbol={profile.nse_symbol} />
            </Suspense>
          </section>
        )}
      </div>

      <section className="mini-card">
        <h3>Senior leadership</h3>
        <ul className="people people-grid">
          {profile.leaders.map((l) => (
            <li key={l.name + l.title}>
              <div>
                <strong>{l.name}</strong>
                <span className="small muted">{l.title}</span>
              </div>
              <a
                className="small"
                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${l.name} ${company}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
            </li>
          ))}
        </ul>
      </section>

      {sources.length > 0 && (
        <details className="sources">
          <summary>Research sources ({sources.length})</summary>
          <ul>
            {sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || hostname(s.url)}</a>
              </li>
            ))}
          </ul>
          <p className="small muted">
            Researched by Gemini Flash with Google Search{refreshedAt ? `, ${formatDate(refreshedAt)}` : ""}. Check names and titles before contacting anyone.
          </p>
        </details>
      )}
    </div>
  );
}

async function PriceTile({ symbol }: { symbol: string }) {
  const s = await getStock(symbol);
  if (!s) return <>Unavailable</>;
  const up = s.changePct >= 0;
  return (
    <>
      {new Intl.NumberFormat("en-IN", { style: "currency", currency: s.currency, maximumFractionDigits: 0 }).format(s.price)}{" "}
      <span className={up ? "delta-up" : "delta-down"}>{up ? "+" : ""}{s.changePct.toFixed(0)}%</span>
    </>
  );
}

async function StockPanel({ symbol }: { symbol: string }) {
  const s = await getStock(symbol);
  if (!s) return <p className="small muted">Price unavailable right now.</p>;
  const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: s.currency, maximumFractionDigits: 2 });
  const up = s.changePct >= 0;
  return (
    <>
      <p className="stock-head">
        <span className="stock-price">{fmt.format(s.price)}</span>
        <span className={up ? "delta-up" : "delta-down"}>
          {up ? "+" : ""}
          {s.changePct.toFixed(1)}% <span className="muted">over 6 months</span>
        </span>
      </p>
      <StockChart points={s.points} currency={s.currency} />
    </>
  );
}

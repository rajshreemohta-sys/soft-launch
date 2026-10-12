import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Gauge, StockChart } from "@/components/Charts";
import { OutreachDrafts } from "@/components/OutreachDrafts";
import { SignalTag, StageTag } from "@/components/Tag";
import { getAccount, getInsight, getProfile, type Signal } from "@/lib/data";
import { formatDate, formatDateLong, formatScore, hostname, sourceLabel } from "@/lib/format";
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
  const lead = signals[0];

  return (
    <>
      <section className="section analysis-head">
        <div>
          <Link href="/accounts" className="back">{"←"} All accounts</Link>
          <h1 className="display" style={{ marginTop: 16 }}>{a.company_name}</h1>
          <p className="facts-line">
            <span>{a.sector}</span>
            {profile?.founded_year && <span>Founded {profile.founded_year}</span>}
            {profile?.headquarters && <span>{profile.headquarters}</span>}
            {profile?.nse_symbol && <span>{profile.listed ? "NSE" : "Parent on NSE"}: {profile.nse_symbol}</span>}
            {profile && !profile.listed && !profile.nse_symbol && <span>Private company</span>}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <StageTag stage={a.deal_stage} />
            {a.hot_rank && <span className="stage">#{a.hot_rank} on the Hot List</span>}
          </div>
        </div>
        <div className="head-gauge">
          <Gauge value={heat} size={220} label="Lead temperature" sublabel={`Signal score ${formatScore(a.signal_score)}`} />
        </div>
      </section>
      <div className="rule" />

      <section className="section">
        <div className="analysis">
          <div className="analysis-main">
            <WhyNow insight={insight} lead={lead} signals={signals} />
            <AiRead insight={insight} a={a} />
            {insight && (
              <Card title="Outreach drafts" id="drafts">
                <OutreachDrafts
                  company={a.company_name}
                  contactName={insight.best_contact.name}
                  contactTitle={insight.best_contact.title}
                  subject={insight.email.subject}
                  body={insight.email.body}
                  linkedinNote={insight.linkedin_note}
                />
              </Card>
            )}
            <Card title="Recent news" id="news">
              <Suspense fallback={<p className="muted small">Fetching the latest headlines…</p>}>
                <RecentNews terms={a.search_terms} />
              </Suspense>
            </Card>
          </div>

          <aside className="analysis-side">
            <section className="panel panel-arjun" aria-labelledby="arjun-h">
              <h2 id="arjun-h" className="card-title">Arjun&rsquo;s notes</h2>
              <p className="panel-note">Arjun owns this panel. The system never edits it.</p>
              <dl className="facts">
                <div><dt>Deal stage</dt><dd><StageTag stage={a.deal_stage} /></dd></div>
                <div><dt>Notes</dt><dd>{a.arjun_notes || "—"}</dd></div>
                <div><dt>Last contact</dt><dd>{formatDateLong(a.last_contact_date)}</dd></div>
                <div><dt>Relationship read</dt><dd>{a.relationship_read || "—"}</dd></div>
              </dl>
            </section>

            <CompanyCard profile={profile} />

            {profile?.nse_symbol && (
              <Card title="Share price" note={`${profile.listed ? "" : "Listed parent, "}NSE: ${profile.nse_symbol}`}>
                <Suspense fallback={<p className="muted small">Loading the price…</p>}>
                  <Stock symbol={profile.nse_symbol} />
                </Suspense>
              </Card>
            )}

            <Financials profile={profile} sources={sources} />
            <Leadership profile={profile} company={a.company_name} />

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
                <p className="small muted">Company facts researched by Gemini Flash with Google Search{profileRow ? `, ${formatDate(profileRow.refreshed_at)}` : ""}. Verify before contacting anyone.</p>
              </details>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}

function Card({ title, note, id, children }: { title: string; note?: string; id?: string; children: React.ReactNode }) {
  return (
    <section className="card" aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="card-head">
        <h2 id={id ? `${id}-h` : undefined} className="card-title">{title}</h2>
        {note && <span className="small muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function WhyNow({ insight, lead, signals }: { insight: Insight | null; lead?: Signal; signals: Signal[] }) {
  return (
    <Card title="Why now: the trigger" id="why">
      {lead ? (
        <>
          {insight && <p className="lead-text">{insight.why_now}</p>}
          <ol className="timeline">
            {signals.slice(0, 6).map((s) => (
              <li key={s.id}>
                <div className="timeline-head">
                  <SignalTag type={s.signal_type} />
                  <span>{formatDate(s.published_at)}</span>
                  <span>Strength {s.strength}/10</span>
                </div>
                <p>{s.summary}</p>
                <a className="small" href={s.source_url} target="_blank" rel="noopener noreferrer">
                  {s.source_title ?? "Source"} ({sourceLabel(s.source_name, s.source_url)})
                </a>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="muted">No trigger events found yet. This account stays cold until news appears.</p>
      )}
    </Card>
  );
}

function AiRead({ insight, a }: { insight: Insight | null; a: Account }) {
  const band = heatBand(heatIndex(Number(a.signal_score)));
  return (
    <Card title="What the AI says" note="Gemini Flash" id="ai">
      {insight ? (
        <div className="ai-read">
          <p className="lead-text">
            <span className={`heat-chip heat-${band.toLowerCase()}`}>{band}</span> {insight.verdict}
          </p>
          {a.outreach_angle && (
            <p className="angle"><span className="angle-label">Hot List outreach angle</span>{a.outreach_angle}</p>
          )}
          <div className="ai-cols">
            <div>
              <h3>How to approach</h3>
              <ol>{insight.approach.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
            <div>
              <h3>Talking points</h3>
              <ul>{insight.talking_points.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          </div>
          <div className="ai-cols">
            <div>
              <h3>Contact first</h3>
              <p>
                <strong>{insight.best_contact.name ?? insight.best_contact.title}</strong>
                {insight.best_contact.name && <span className="muted">, {insight.best_contact.title}</span>}
              </p>
              <p className="small muted">{insight.best_contact.why}</p>
            </div>
            <div>
              <h3>Be ready for</h3>
              <ul>{insight.risks.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          </div>
        </div>
      ) : (
        <p className="muted">The AI read is being prepared. Refresh in a minute.</p>
      )}
    </Card>
  );
}

function CompanyCard({ profile }: { profile: CompanyProfile | null }) {
  if (!profile) return null;
  return (
    <Card title="Company">
      <p className="small">{profile.business_summary}</p>
      <dl className="facts facts-grid">
        <div><dt>Founded</dt><dd>{profile.founded_year ?? "—"}</dd></div>
        <div><dt>Headquarters</dt><dd>{profile.headquarters ?? "—"}</dd></div>
        <div><dt>Workforce</dt><dd>{profile.employees ?? "—"}</dd></div>
        <div><dt>Ownership</dt><dd>{profile.listed ? "Listed" : profile.parent_company ? `Part of ${profile.parent_company}` : "Private"}</dd></div>
      </dl>
    </Card>
  );
}

function Financials({ profile, sources }: { profile: CompanyProfile | null; sources: Source[] }) {
  if (!profile) return null;
  const f = profile.financials;
  const report = reportLink(sources);
  return (
    <Card title="Financials" note={f.fiscal_year ?? undefined}>
      <dl className="facts facts-grid">
        <div><dt>Revenue</dt><dd>{f.revenue ?? "Not disclosed"}</dd></div>
        <div><dt>Net profit</dt><dd>{f.net_profit ?? "Not disclosed"}</dd></div>
      </dl>
      {f.note && <p className="small muted" style={{ marginTop: 10 }}>{f.note}</p>}
      {report ? (
        <p style={{ marginTop: 12 }}>
          <a className="btn btn-sm btn-ghost" href={report.url} target="_blank" rel="noopener noreferrer">
            {/\.pdf/i.test(report.url) ? "Annual report (PDF)" : "Investor relations"}
          </a>
        </p>
      ) : (
        <p className="small muted" style={{ marginTop: 10 }}>
          {profile.listed || profile.nse_symbol ? "No annual report link found in the research sources." : "Private company: no public balance sheet. Figures are from filings reported in the news."}
        </p>
      )}
    </Card>
  );
}

function Leadership({ profile, company }: { profile: CompanyProfile | null; company: string }) {
  if (!profile?.leaders.length) return null;
  return (
    <Card title="Senior leadership">
      <ul className="people">
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
    </Card>
  );
}

async function Stock({ symbol }: { symbol: string }) {
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

async function RecentNews({ terms }: { terms: string[] }) {
  const news = await getRecentNews(terms);
  if (!news.length) return <p className="muted small">No coverage in the last 14 days.</p>;
  return (
    <ul className="news">
      {news.map((n) => (
        <li key={n.url}>
          <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
          <span className="small muted">{sourceLabel(n.source, n.url)} · {formatDate(n.publishedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

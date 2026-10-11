import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { SignalTag, StageTag } from "@/components/Tag";
import { getAccount } from "@/lib/data";
import { formatDate, formatDateLong, formatScore, sourceLabel } from "@/lib/format";

export default function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  return (
    <Suspense fallback={<section className="section"><p className="muted">Loading account…</p></section>}>
      <Account params={params} />
    </Suspense>
  );
}

async function Account({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const data = await getAccount(id);
  if (!data) notFound();
  const { account: a, signals } = data;

  return (
    <>
      <section className="section" style={{ paddingBottom: 32 }}>
        <Link href="/accounts" className="back">{"←"} All accounts</Link>
        <h1 className="display" style={{ marginTop: 20 }}>{a.company_name}</h1>
        <p className="lede">{a.sector}</p>
      </section>
      <div className="rule" />
      <section className="section">
        <div className="panels">
          <section className="panel panel-arjun" aria-labelledby="arjun-h">
            <h2 id="arjun-h" className="display" style={{ fontSize: 26 }}>Arjun&rsquo;s notes</h2>
            <p className="panel-note">Arjun owns this panel. The system never edits it.</p>
            <dl className="facts">
              <div>
                <dt>Deal stage</dt>
                <dd><StageTag stage={a.deal_stage} /></dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{a.arjun_notes || "—"}</dd>
              </div>
              <div>
                <dt>Last contact</dt>
                <dd>{formatDateLong(a.last_contact_date)}</dd>
              </div>
              <div>
                <dt>Relationship read</dt>
                <dd>{a.relationship_read || "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="panel" aria-labelledby="system-h">
            <h2 id="system-h" className="display" style={{ fontSize: 26 }}>What the system found</h2>
            <p className="panel-note">
              Written only by the pipeline.{" "}
              {a.last_checked_at ? `News last checked ${formatDateLong(a.last_checked_at)}.` : "News not checked since scoring began."}
            </p>
            <dl className="facts">
              <div style={{ display: "flex", gap: 24, alignItems: "end", flexWrap: "wrap" }}>
                <div>
                  <dt>Signal score</dt>
                  <dd className="big-score">{formatScore(a.signal_score)}</dd>
                </div>
                {a.hot_rank && (
                  <div>
                    <dt>Hot List</dt>
                    <dd className="big-score">#{a.hot_rank}</dd>
                  </div>
                )}
              </div>
              {a.outreach_angle && (
                <div>
                  <dt>Current outreach angle</dt>
                  <dd className="angle" style={{ marginTop: 6 }}>{a.outreach_angle}</dd>
                </div>
              )}
            </dl>

            <h3 className="display" style={{ marginTop: 28 }}>Signal timeline</h3>
            {signals.length ? (
              <ol className="timeline">
                {signals.map((s) => (
                  <li key={s.id}>
                    <div className="timeline-head">
                      <SignalTag type={s.signal_type} />
                      <span>{formatDate(s.published_at)}</span>
                      <span>Strength {s.strength}/10</span>
                    </div>
                    <p>{s.summary}</p>
                    {s.reasoning && <p className="reasoning">Why it matters: {s.reasoning}</p>}
                    <a className="small" href={s.source_url} target="_blank" rel="noopener noreferrer">
                      {s.source_title ? `${s.source_title}` : "Source"}
                      {` (${sourceLabel(s.source_name)})`}
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted" style={{ marginTop: 8 }}>
                No trigger events found yet. The account stays at the bottom of the ranking until news appears.
              </p>
            )}
          </section>
        </div>
      </section>
    </>
  );
}

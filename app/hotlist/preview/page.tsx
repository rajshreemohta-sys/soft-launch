import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { EmailFrame } from "@/components/EmailFrame";
import { getLatestHotList } from "@/lib/data";
import { formatRunTime } from "@/lib/format";

export const metadata: Metadata = { title: "Email preview" };

export default function PreviewPage() {
  return (
    <>
      <section className="page-head">
        <h1 className="page-title">Email preview</h1>
        <p className="muted small">The latest Monday and Thursday Hot List email, exactly as it was (or will be) sent to Arjun.</p>
      </section>
      <div className="rule" />
      <section className="section">
        <Suspense fallback={<p className="muted">Loading the latest email…</p>}>
          <Preview />
        </Suspense>
      </section>
    </>
  );
}

async function Preview() {
  await connection();
  const latest = await getLatestHotList();
  if (!latest) {
    return (
      <div className="empty">
        <strong>No Hot List email has been built yet.</strong>
        It appears here after the next Monday or Thursday run, or when someone sends the Hot List now.
      </div>
    );
  }
  const status = latest.dry_run
    ? "Dry run: built and saved, not emailed."
    : latest.sent_at
      ? `Emailed to Arjun ${formatRunTime(latest.sent_at)}.`
      : `Not emailed${latest.error ? `: ${latest.error}` : "."}`;
  return (
    <>
      <dl className="facts" style={{ marginBottom: 24, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div>
          <dt>Subject</dt>
          <dd>{latest.subject}</dd>
        </div>
        <div>
          <dt>Built</dt>
          <dd>{formatRunTime(latest.created_at)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
        <div>
          <dt>Full size</dt>
          <dd>
            <a href="/hotlist/preview/email" target="_blank" rel="noopener">Open the email in a new tab</a>
          </dd>
        </div>
      </dl>
      <EmailFrame html={latest.html} title={`Email: ${latest.subject}`} />
    </>
  );
}

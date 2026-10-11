import { Suspense } from "react";
import { connection } from "next/server";
import { Arcs } from "@/components/Arcs";
import { HotCard } from "@/components/HotCard";
import { getHotList, getLastRun } from "@/lib/data";
import { formatRunTime } from "@/lib/format";
import { HOT_LIST_WINDOW_DAYS, SITE } from "@/lib/site";

export default function HotListPage() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Hot List</p>
          <h1 className="display">{SITE.headline}</h1>
          <p className="lede">
            Accounts with a fresh trigger in the last {HOT_LIST_WINDOW_DAYS} days, ranked by signal strength. Fresh
            news rises, quiet accounts fade.
          </p>
        </div>
        <Arcs />
      </section>
      <Suspense fallback={<Band text="Loading the latest signals…" />}>
        <HotList />
      </Suspense>
    </>
  );
}

function Band({ text, note }: { text: string; note?: string }) {
  return (
    <div className="band">
      <div className="band-inner">
        <p>{text}</p>
        {note && <span className="small muted">{note}</span>}
      </div>
    </div>
  );
}

async function HotList() {
  await connection();
  const [{ entries, saved, eligibleCount }, lastCollect] = await Promise.all([getHotList(), getLastRun("collect")]);

  const updated = lastCollect ? `Updated ${formatRunTime(lastCollect.finished_at!)}.` : "Not collected yet.";
  const note = saved
    ? `Hot List built ${formatRunTime(saved.created_at)}${saved.dry_run ? " (dry run, not emailed)" : saved.sent_at ? ", emailed to Arjun" : ""}.`
    : "Live ranking. Outreach angles are added when the Hot List email is built.";
  const count =
    eligibleCount === 1 ? "1 account has fresh signals." : `${eligibleCount} accounts have fresh signals.`;

  return (
    <>
      <Band
        text={`${updated} ${count}`}
        note={note}
      />
      <section className="section">
        {entries.length ? (
          <ol className="hotlist">
            {entries.map((e) => (
              <HotCard key={e.account.id} entry={e} />
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

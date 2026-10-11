import Link from "next/link";
import type { HotListEntry } from "@/lib/data";
import { formatDate, formatScore, sourceLabel } from "@/lib/format";
import { SignalTag, StageTag } from "./Tag";

export function HotCard({ entry }: { entry: HotListEntry }) {
  const { account, signal } = entry;
  return (
    <li className="hot-item">
      <span className="rank" aria-label={`Rank ${entry.rank}`}>
        {String(entry.rank).padStart(2, "0")}
      </span>
      <article className="window">
        <div className={`window-bar bar-${signal.signal_type}`}>
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <Link href={`/accounts/${account.id}`}>{account.company_name}</Link>
        </div>
        <div className="window-body">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SignalTag type={signal.signal_type} />
            <StageTag stage={account.deal_stage} />
          </div>
          <p className="summary">{signal.summary}</p>
          {account.outreach_angle && (
            <p className="angle">
              <span className="angle-label">Outreach angle</span>
              {account.outreach_angle}
            </p>
          )}
          <div className="window-meta">
            <a href={signal.source_url} target="_blank" rel="noopener noreferrer">
              {sourceLabel(signal.source_name)}
            </a>
            <span>{formatDate(signal.published_at)}</span>
            <Link href={`/accounts/${account.id}`}>All signals</Link>
            <span className="score">Score {formatScore(account.signal_score)}</span>
          </div>
        </div>
      </article>
    </li>
  );
}

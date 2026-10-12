"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeatMeter } from "@/components/Charts";
import { SignalTag, StageTag } from "@/components/Tag";
import { heatBand, heatIndex, HEAT_BANDS } from "@/lib/heat";
import { DEAL_STAGE_LABELS, formatDate, shortRevenue } from "@/lib/format";
import { SIGNAL_LABELS, SIGNAL_TYPES } from "@/lib/taxonomy";

export type AccountRow = {
  id: string;
  rank: number | null;
  company: string;
  sector: string;
  stage: string | null;
  score: number;
  signalType: string | null;
  signalSummary: string | null;
  signalDate: string | null;
  lastContact: string | null;
  revenue: string | null;
  leader: string | null;
};

type SortKey = "score" | "company" | "stage" | "signalDate" | "lastContact";

const COLUMNS: { key: SortKey | null; label: string; num?: boolean }[] = [
  { key: null, label: "#", num: true },
  { key: "company", label: "Company" },
  { key: "stage", label: "Deal stage" },
  { key: "score", label: "Temperature" },
  { key: null, label: "Latest trigger" },
  { key: "signalDate", label: "Last signal" },
  { key: "lastContact", label: "Last contact" },
];

// Quiet accounts are ordered by how far along the deal is: they matter most there.
const STAGE_ORDER: Record<string, number> = { pilot: 0, customer_expansion: 1, in_conversation: 2, outreach: 3 };

export function AccountsTable({ rows, initialTemp = "all", initialSort = "score" }: { rows: AccountRow[]; initialTemp?: string; initialSort?: "score" | "recent" }) {
  const [stage, setStage] = useState("all");
  const [type, setType] = useState("all");
  const [temp, setTemp] = useState(initialTemp);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(
    initialSort === "recent" ? { key: "signalDate", dir: -1 } : { key: "score", dir: -1 }
  );

  const tempOk = (r: AccountRow) => temp === "all" || heatBand(heatIndex(r.score)).toLowerCase() === temp;
  const stageOk = (r: AccountRow) => (stage === "all" || r.stage === stage) && tempOk(r);

  const active = useMemo(() => {
    const value = (r: AccountRow) => r[sort.key] ?? "";
    return rows
      .filter((r) => r.score > 0 && stageOk(r) && (type === "all" || r.signalType === type))
      .sort((a, b) => {
        const av = value(a);
        const bv = value(b);
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return cmp * sort.dir || a.company.localeCompare(b.company);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, stage, type, temp, sort]);

  const quiet = useMemo(
    () =>
      type !== "all"
        ? []
        : rows
            .filter((r) => r.score <= 0 && stageOk(r))
            .sort((a, b) => (STAGE_ORDER[a.stage ?? ""] ?? 9) - (STAGE_ORDER[b.stage ?? ""] ?? 9) || a.company.localeCompare(b.company)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, stage, type, temp]
  );

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "company" || key === "stage" ? 1 : -1 }));

  return (
    <>
      <div className="filters">
        <label>
          Deal stage
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">All stages</option>
            {Object.entries(DEAL_STAGE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          Temperature
          <select value={temp} onChange={(e) => setTemp(e.target.value)}>
            <option value="all">All temperatures</option>
            {HEAT_BANDS.map((b) => (
              <option key={b} value={b.toLowerCase()}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          Latest trigger
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {SIGNAL_TYPES.map((t) => (
              <option key={t} value={t}>{SIGNAL_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <span className="small muted" aria-live="polite">
          {active.length} active · {quiet.length} quiet
        </span>
      </div>

      {temp !== "cold" && (
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Active accounts">
        <table className="table">
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const active = c.key !== null && sort.key === c.key;
                return (
                  <th key={c.label} className={c.num ? "num" : undefined} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    {c.key ? (
                      <button type="button" onClick={() => toggle(c.key!)}>
                        {c.label}
                        {active ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {active.map((r) => (
              <tr key={r.id}>
                <td className="num">{r.rank}</td>
                <td className="company">
                  <Link href={`/accounts/${r.id}`}>{r.company}</Link>
                  <div className="small muted">{r.sector}</div>
                </td>
                <td><StageTag stage={r.stage} /></td>
                <td><HeatMeter value={heatIndex(r.score)} /></td>
                <td className="wrap">
                  <div className="trigger-cell">
                    <SignalTag type={r.signalType} />
                    {r.signalSummary && <span className="small muted">{r.signalSummary}</span>}
                  </div>
                </td>
                <td>{formatDate(r.signalDate)}</td>
                <td>{formatDate(r.lastContact)}</td>
              </tr>
            ))}
            {!active.length && (
              <tr>
                <td colSpan={COLUMNS.length} className="muted">No active accounts match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {quiet.length > 0 && (
        <section className="quiet" aria-labelledby="quiet-h">
          <div className="section-head">
            <h2 id="quiet-h" className="display section-title">Quiet accounts</h2>
            <p className="muted small">{quiet.length} with no trigger in 30 days, furthest-along deals first. They rise as soon as news appears.</p>
          </div>
          <ul className="quiet-tiles">
            {quiet.map((r) => (
              <li key={r.id}>
                <Link href={`/accounts/${r.id}`} className="quiet-tile">
                  <strong>{r.company}</strong>
                  <StageTag stage={r.stage} />
                  <dl>
                    <div><dt>Last contact</dt><dd>{formatDate(r.lastContact)}</dd></div>
                    <div><dt>Revenue</dt><dd>{shortRevenue(r.revenue)}</dd></div>
                  </dl>
                  {r.leader && <span className="quiet-leader small muted">{r.leader}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

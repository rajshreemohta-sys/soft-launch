"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeatMeter } from "@/components/Charts";
import { SignalTag, StageTag } from "@/components/Tag";
import { heatIndex } from "@/lib/heat";
import { DEAL_STAGE_LABELS, formatDate, formatScore } from "@/lib/format";
import { SIGNAL_LABELS, SIGNAL_TYPES } from "@/lib/taxonomy";

export type AccountRow = {
  id: string;
  rank: number | null;
  company: string;
  sector: string;
  stage: string | null;
  score: number;
  signalType: string | null;
  signalDate: string | null;
  lastContact: string | null;
};

type SortKey = "score" | "company" | "sector" | "stage" | "signalDate" | "lastContact";

const COLUMNS: { key: SortKey | null; label: string; num?: boolean }[] = [
  { key: "score", label: "Rank", num: true },
  { key: "company", label: "Company" },
  { key: "sector", label: "Sector" },
  { key: "stage", label: "Deal stage" },
  { key: "score", label: "Temperature" },
  { key: null, label: "Latest signal" },
  { key: "signalDate", label: "Last signal" },
  { key: "lastContact", label: "Last contact" },
];

export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  const [stage, setStage] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });

  const visible = useMemo(() => {
    const filtered = rows.filter(
      (r) => (stage === "all" || r.stage === stage) && (type === "all" || r.signalType === type)
    );
    const value = (r: AccountRow) => r[sort.key] ?? "";
    return filtered.sort((a, b) => {
      // Quiet accounts always sit at the bottom.
      if ((a.score > 0) !== (b.score > 0)) return a.score > 0 ? -1 : 1;
      const av = value(a);
      const bv = value(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return cmp * sort.dir || a.company.localeCompare(b.company);
    });
  }, [rows, stage, type, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "company" || key === "sector" || key === "stage" ? 1 : -1 }));

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
          Latest signal
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {SIGNAL_TYPES.map((t) => (
              <option key={t} value={t}>{SIGNAL_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <span className="small muted" aria-live="polite">
          {visible.length} of {rows.length} accounts
        </span>
      </div>

      <div className="table-scroll" tabIndex={0} role="region" aria-label="Accounts table">
        <table className="table">
          <thead>
            <tr>
              {COLUMNS.map((c, i) => {
                const active = c.key !== null && sort.key === c.key && (i !== 0 || sort.key === "score");
                return (
                  <th
                    key={c.label}
                    className={c.num ? "num" : undefined}
                    aria-sort={active && i !== 0 ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  >
                    {c.key ? (
                      <button type="button" onClick={() => toggle(c.key!)}>
                        {c.label}
                        {active && i !== 0 ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
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
            {visible.map((r) => (
              <tr key={r.id} className={r.score > 0 ? undefined : "quiet"}>
                <td className="num">{r.rank ?? "—"}</td>
                <td className="company">
                  <Link href={`/accounts/${r.id}`}>{r.company}</Link>
                </td>
                <td className="wrap">{r.sector}</td>
                <td><StageTag stage={r.stage} /></td>
                <td><HeatMeter value={heatIndex(r.score)} /> <span className="small muted">({formatScore(r.score)})</span></td>
                <td>{r.score > 0 ? <SignalTag type={r.signalType} /> : <span>Quiet</span>}</td>
                <td>{formatDate(r.signalDate)}</td>
                <td>{formatDate(r.lastContact)}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={8} className="muted">No accounts match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

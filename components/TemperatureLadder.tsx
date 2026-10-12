import Link from "next/link";
import { heatBand } from "@/lib/heat";
import { DEAL_STAGE_LABELS } from "@/lib/format";
import { SignalTag } from "./Tag";

type Row = { id: string; name: string; stage: string | null; heat: number; signalType: string | null };

// Hottest leads as one ranked panel: a cold-to-hot scale per row with a marker at the
// lead's temperature. The value and band label are always printed, so colour is never
// the only cue.
export function TemperatureLadder({ rows }: { rows: Row[] }) {
  return (
    <div className="ladder">
      <ol>
        {rows.map((r, i) => {
          const band = heatBand(r.heat);
          return (
            <li key={r.id}>
              <Link href={`/accounts/${r.id}`} className="ladder-row">
                <span className="ladder-rank">{String(i + 1).padStart(2, "0")}</span>
                <span className="ladder-name">
                  <strong>{r.name}</strong>
                  {r.stage && <span className="stage">{DEAL_STAGE_LABELS[r.stage] ?? r.stage}</span>}
                </span>
                <span className="ladder-scale" role="img" aria-label={`${band}, ${r.heat} out of 100`}>
                  <span className="ladder-marker" style={{ left: `${r.heat}%` }} />
                </span>
                <span className="ladder-value">{r.heat}</span>
                <span className="ladder-tags">
                  <span className={`heat-chip heat-${band.toLowerCase()}`}>{band}</span>
                  <SignalTag type={r.signalType} />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="ladder-axis" aria-hidden="true">
        <span />
        <span className="ladder-ticks">
          <span>Cold</span>
          <span style={{ left: "17%" }}>Cool</span>
          <span style={{ left: "35%" }}>Warm 35</span>
          <span style={{ left: "65%" }}>Hot 65</span>
          <span style={{ left: "100%" }}>100</span>
        </span>
      </div>
    </div>
  );
}

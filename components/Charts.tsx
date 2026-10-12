import { HEAT_BANDS, HEAT_COLORS, heatBand, type HeatBand } from "@/lib/heat";
import { SIGNAL_LABELS, SIGNAL_TYPES, type SignalType } from "@/lib/taxonomy";

// Server-rendered SVG charts in the dashboard palette. Identity is never colour alone:
// every bar carries a text label, and each mark has a hover tooltip (<title>).

// Colours are CSS variables so light and dark themes both work. SVG presentation
// attributes can't read var(), so marks set colours through style={{ ... }}.
export const TYPE_COLOR: Record<SignalType, string> = {
  headcount_expansion: "var(--green)",
  new_leader: "var(--terracotta)",
  workforce_digitalisation: "var(--sage)",
  funding: "var(--mauve)",
  operational_challenge: "var(--ink)",
  other_relevant: "var(--line)",
};

const MUTED = "var(--muted)";
const GRID = "var(--grid)";
const TRACK = "var(--heat-track)";

// ---------------------------------------------------------------- gauge (semicircle meter)

export function Gauge({ value, size = 180, label, sublabel }: { value: number; size?: number; label?: string; sublabel?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const band = heatBand(v);
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const stroke = Math.max(10, size / 11);
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    const p = (a: number) => `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`;
    return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`; // a semicircle never needs the large-arc sweep
  };
  return (
    <figure className="gauge" style={{ width: size }}>
      <svg viewBox={`0 0 ${size} ${size / 2 + 14}`} role="img" aria-label={`${label ?? "Lead"}: ${band}, ${v} out of 100`}>
        <title>{`${label ?? "Lead"}: ${band}, ${v}/100`}</title>
        <path d={arc(0, 100)} fill="none" style={{ stroke: TRACK }} strokeWidth={stroke} strokeLinecap="round" />
        {v > 0 && <path d={arc(0, Math.max(v, 1.5))} fill="none" style={{ stroke: HEAT_COLORS[band] }} strokeWidth={stroke} strokeLinecap="round" />}
        <text x={cx} y={cy - 6} textAnchor="middle" className="gauge-value" fontSize={size / 4.6}>{v}</text>
      </svg>
      <figcaption>
        <span className={`heat-chip heat-${band.toLowerCase()}`}>{band}</span>
        {label && <span className="gauge-label">{label}</span>}
        {sublabel && <span className="gauge-sub">{sublabel}</span>}
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- mini gauge (no caption)

export function MiniGauge({ value, size = 96 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const band = heatBand(v);
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2 + 2;
  const stroke = Math.max(8, size / 11);
  const p = (a: number) => `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`;
  const arc = (t: number) => `M ${p(Math.PI)} A ${r} ${r} 0 0 1 ${p(Math.PI * (1 - t / 100))}`;
  return (
    <svg width={size} viewBox={`0 0 ${size} ${size / 2 + 10}`} role="img" aria-label={`${band}, ${v} out of 100`}>
      <title>{`${band}, ${v}/100`}</title>
      <path d={arc(100)} fill="none" style={{ stroke: TRACK }} strokeWidth={stroke} strokeLinecap="round" />
      {v > 0 && <path d={arc(Math.max(v, 1.5))} fill="none" style={{ stroke: HEAT_COLORS[band] }} strokeWidth={stroke} strokeLinecap="round" />}
      <text x={cx} y={cy - 4} textAnchor="middle" className="gauge-value" fontSize={size / 4.2}>{v}</text>
    </svg>
  );
}

// ---------------------------------------------------------------- inline heat meter (bar)

export function HeatMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const band = heatBand(v);
  return (
    <span className="heat-meter" title={`${band}, ${v}/100`}>
      <span className="heat-track" aria-hidden="true">
        <span className="heat-fill" style={{ width: `${Math.max(v, v > 0 ? 3 : 0)}%`, background: HEAT_COLORS[band] }} />
      </span>
      <span className="heat-text">
        {band} <span className="muted">{v}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- signals per day (columns)

export function SignalsPerDay({ days }: { days: { date: string; label: string; count: number }[] }) {
  const W = 1000;
  const H = 200;
  const pad = { l: 28, r: 8, t: 24, b: 26 };
  const max = Math.max(2, ...days.map((d) => d.count));
  const ticks = max <= 4 ? [0, max] : [0, Math.round(max / 2), max];
  const slot = (W - pad.l - pad.r) / days.length;
  const bw = Math.min(24, slot - 2);
  const y = (n: number) => pad.t + (H - pad.t - pad.b) * (1 - n / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`New trigger events per day over the last ${days.length} days`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} style={{ stroke: GRID }} strokeWidth={1} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = pad.l + i * slot + (slot - bw) / 2;
        const h = y(0) - y(d.count);
        return (
          <g key={d.date}>
            <title>{`${d.label}: ${d.count} new ${d.count === 1 ? "signal" : "signals"}`}</title>
            <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
            {d.count > 0 && <path d={roundedTop(x, y(d.count), bw, h, 4)} style={{ fill: "var(--chart-green)" }} />}
            {d.count > 0 && <text x={x + bw / 2} y={y(d.count) - 6} textAnchor="middle" className="axis">{d.count}</text>}
          </g>
        );
      })}
      {days.map((d, i) =>
        (days.length - 1 - i) % 2 === 0 ? (
          <text key={d.date} x={pad.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="axis">{d.label}</text>
        ) : null
      )}
    </svg>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

// ---------------------------------------------------------------- triggers by type (labelled bars)

export function TriggersByType({ counts }: { counts: Partial<Record<SignalType, number>> }) {
  const rows = SIGNAL_TYPES.map((t) => ({ t, n: counts[t] ?? 0 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="muted small">No trigger events in the last 30 days.</p>;
  return (
    <ul className="hbars">
      {rows.map(({ t, n }) => (
        <li key={t} title={`${SIGNAL_LABELS[t]}: ${n}`}>
          <span className="hbar-label">{SIGNAL_LABELS[t]}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(n / max) * 100}%`, background: TYPE_COLOR[t], outline: t === "other_relevant" ? `1px solid ${MUTED}` : undefined }} />
          </span>
          <span className="hbar-value">{n}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- deal stage x temperature (stacked bars)

export function StageTemperature({ rows }: { rows: { stage: string; counts: Record<HeatBand, number> }[] }) {
  const max = Math.max(1, ...rows.map((r) => HEAT_BANDS.reduce((s, b) => s + r.counts[b], 0)));
  return (
    <div>
      <ul className="legend" aria-label="Legend">
        {HEAT_BANDS.map((b) => (
          <li key={b}>
            <span className="swatch" style={{ background: HEAT_COLORS[b], outline: b === "Cold" ? `1px solid ${GRID}` : undefined }} />
            {b}
          </li>
        ))}
      </ul>
      <ul className="hbars">
        {rows.map((r) => {
          const total = HEAT_BANDS.reduce((s, b) => s + r.counts[b], 0);
          return (
            <li key={r.stage}>
              <span className="hbar-label">{r.stage}</span>
              <span className="hbar-track stacked">
                {HEAT_BANDS.map((b) =>
                  r.counts[b] ? (
                    <span
                      key={b}
                      className="hbar-seg"
                      title={`${r.stage}: ${r.counts[b]} ${b.toLowerCase()}`}
                      style={{ width: `${(r.counts[b] / max) * 100}%`, background: HEAT_COLORS[b] }}
                    />
                  ) : null
                )}
              </span>
              <span className="hbar-value">{total}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- stock price (line + wash)

export function StockChart({ points, currency }: { points: { t: number; close: number }[]; currency: string }) {
  const W = 360;
  const H = 140;
  const pad = { l: 4, r: 4, t: 10, b: 20 };
  const closes = points.map((p) => p.close);
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo || 1;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
  const up = closes.at(-1)! >= closes[0];
  const color = up ? "var(--chart-green)" : "var(--down)";
  const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const month = (t: number) => new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(t);
  const step = Math.max(1, Math.floor(points.length / 40));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Share price over 6 months, from ${fmt(closes[0])} to ${fmt(closes.at(-1)!)}`}>
      <path d={`${line} L${x(points.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`} style={{ fill: color }} opacity={0.12} />
      <path d={line} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(closes.at(-1)!)} r={4} style={{ fill: color, stroke: "var(--paper)" }} strokeWidth={2} />
      {points.map((p, i) =>
        i % step === 0 ? (
          <rect key={p.t} x={x(i) - (W / points.length) * step / 2} y={0} width={(W / points.length) * step} height={H - pad.b} fill="transparent">
            <title>{`${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(p.t)}: ${fmt(p.close)}`}</title>
          </rect>
        ) : null
      )}
      <text x={pad.l} y={H - 4} className="axis">{month(points[0].t)}</text>
      <text x={W - pad.r} y={H - 4} textAnchor="end" className="axis">{month(points.at(-1)!.t)}</text>
    </svg>
  );
}


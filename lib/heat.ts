// Lead temperature: maps the signal score (open-ended, ~0-35 in practice) onto 0-100
// with diminishing returns, then into four bands. Shown on meters across the dashboard.

export type HeatBand = "Hot" | "Warm" | "Cool" | "Cold";

const SCALE = 12; // a score of 12 reads as ~63/100

export function heatIndex(score: number): number {
  if (!(score > 0)) return 0;
  return Math.round(100 * (1 - Math.exp(-score / SCALE)));
}

export function heatBand(heat: number): HeatBand {
  if (heat >= 65) return "Hot";
  if (heat >= 35) return "Warm";
  if (heat > 0) return "Cool";
  return "Cold";
}

export const HEAT_BANDS: HeatBand[] = ["Hot", "Warm", "Cool", "Cold"];

// One hue, sequential: hotter bands are stronger steps of terracotta. CSS variables, so
// the dark theme can supply its own ramp (brightest = hottest on a dark surface).
export const HEAT_COLORS: Record<HeatBand, string> = {
  Hot: "var(--heat-hot)",
  Warm: "var(--heat-warm)",
  Cool: "var(--heat-cool)",
  Cold: "var(--heat-cold)",
};

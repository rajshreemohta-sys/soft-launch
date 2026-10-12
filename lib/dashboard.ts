import "server-only";
import { getAccounts, getHotList, getRecentSignals } from "./data";
import { DEAL_STAGE_LABELS } from "./format";
import { HEAT_BANDS, heatBand, heatIndex, type HeatBand } from "./heat";
import type { SignalType } from "./taxonomy";

// Everything the home dashboard shows, computed in one place.

const TZ = "Asia/Kolkata";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const dayLabel = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ }).format(d);
const emptyBands = () => Object.fromEntries(HEAT_BANDS.map((b) => [b, 0])) as Record<HeatBand, number>;

// Next Monday or Thursday Hot List (8 AM IST).
export function nextHotList(now: Date): string {
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const wd = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ }).format(d);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(d));
    if ((wd === "Mon" || wd === "Thu") && (i > 0 || hour < 8)) {
      return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: TZ }).format(d);
    }
  }
  return "Monday";
}

export async function getDashboard() {
  const now = new Date();
  const [{ entries }, accounts, signals] = await Promise.all([getHotList(), getAccounts(), getRecentSignals(30)]);

  const withHeat = accounts.map((a) => ({ a, heat: heatIndex(Number(a.signal_score)) }));
  const bandCounts = emptyBands();
  withHeat.forEach(({ heat }) => bandCounts[heatBand(heat)]++);

  const perDay = new Map<string, number>();
  signals.forEach((s) => {
    const k = dayKey(new Date(s.published_at));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  });
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getTime() - (13 - i) * 86_400_000);
    return { date: dayKey(d), label: dayLabel(d), count: perDay.get(dayKey(d)) ?? 0 };
  });

  const byType: Partial<Record<SignalType, number>> = {};
  signals.forEach((s) => {
    const t = s.signal_type as SignalType;
    byType[t] = (byType[t] ?? 0) + 1;
  });

  const stageRows = Object.entries(DEAL_STAGE_LABELS).map(([key, label]) => {
    const counts = emptyBands();
    withHeat.filter((x) => x.a.deal_stage === key).forEach((x) => counts[heatBand(x.heat)]++);
    return { stage: label, counts };
  });

  return {
    entries,
    bandCounts,
    hottest: withHeat.filter((x) => x.heat > 0).slice(0, 8),
    newThisWeek: signals.filter((s) => now.getTime() - new Date(s.published_at).getTime() <= 7 * 86_400_000).length,
    nextHotList: nextHotList(now),
    days,
    byType,
    stageRows,
  };
}

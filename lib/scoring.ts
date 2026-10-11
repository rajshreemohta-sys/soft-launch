import type { SignalType } from "./taxonomy";

// Scoring (CLAUDE.md section 9).
//   signal_value  = strength × type_weight × 0.5 ^ (age_days / HALF_LIFE_DAYS)
//   account_score = sum of signal_value over the last LOOKBACK_DAYS, × MOMENTUM_MULTIPLIER
//                   if there are 2+ signals of different types in the last MOMENTUM_WINDOW_DAYS.
// Old and new signals combine, so a pattern (funding, then a new HR leader, then hiring)
// outranks a single fresh headline, while quiet accounts fade to zero on their own.

export const HALF_LIFE_DAYS = 7;
export const LOOKBACK_DAYS = 30;
export const MOMENTUM_WINDOW_DAYS = 14;
export const MOMENTUM_MULTIPLIER = 1.2;

export const TYPE_WEIGHTS: Record<SignalType, number> = {
  new_leader: 1.3,
  funding: 1.2,
  headcount_expansion: 1.2,
  workforce_digitalisation: 1.1,
  operational_challenge: 1.0,
  other_relevant: 0.5,
};

export type ScorableSignal = { signal_type: SignalType; strength: number; published_at: string | Date };

const DAY_MS = 86_400_000;

function ageDays(publishedAt: string | Date, now: Date): number {
  // Future-dated articles (timezone quirks) count as brand new, never as a bonus.
  return Math.max(0, (now.getTime() - new Date(publishedAt).getTime()) / DAY_MS);
}

export function signalValue(s: ScorableSignal, now: Date = new Date()): number {
  return s.strength * TYPE_WEIGHTS[s.signal_type] * 0.5 ** (ageDays(s.published_at, now) / HALF_LIFE_DAYS);
}

export function hasMomentum(signals: ScorableSignal[], now: Date = new Date()): boolean {
  const recentTypes = new Set(
    signals.filter((s) => ageDays(s.published_at, now) <= MOMENTUM_WINDOW_DAYS).map((s) => s.signal_type)
  );
  return recentTypes.size >= 2;
}

export function accountScore(signals: ScorableSignal[], now: Date = new Date()): number {
  const inLookback = signals.filter((s) => ageDays(s.published_at, now) <= LOOKBACK_DAYS);
  if (!inLookback.length) return 0;
  const sum = inLookback.reduce((total, s) => total + signalValue(s, now), 0);
  const score = hasMomentum(inLookback, now) ? sum * MOMENTUM_MULTIPLIER : sum;
  return Math.round(score * 100) / 100;
}

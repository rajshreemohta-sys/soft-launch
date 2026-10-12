import { test } from "node:test";
import assert from "node:assert/strict";
import { accountScore, signalValue, hasMomentum, HALF_LIFE_DAYS, type ScorableSignal } from "../lib/scoring";

const NOW = new Date("2026-10-15T08:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const sig = (signal_type: ScorableSignal["signal_type"], strength: number, age: number): ScorableSignal => ({
  signal_type,
  strength,
  published_at: daysAgo(age),
});

test("decay: a signal is worth half after one half-life and a quarter after two", () => {
  const fresh = signalValue(sig("operational_challenge", 8, 0), NOW);
  assert.equal(fresh, 8);
  assert.ok(Math.abs(signalValue(sig("operational_challenge", 8, HALF_LIFE_DAYS), NOW) - 4) < 1e-9);
  assert.ok(Math.abs(signalValue(sig("operational_challenge", 8, 2 * HALF_LIFE_DAYS), NOW) - 2) < 1e-9);
});

test("type weights: same strength and age, new_leader beats operational_challenge beats other_relevant", () => {
  const leader = signalValue(sig("new_leader", 7, 1), NOW);
  const challenge = signalValue(sig("operational_challenge", 7, 1), NOW);
  const other = signalValue(sig("other_relevant", 7, 1), NOW);
  assert.ok(leader > challenge && challenge > other);
  assert.ok(Math.abs(leader / challenge - 1.3) < 1e-9);
  assert.ok(Math.abs(other / challenge - 0.5) < 1e-9);
});

test("momentum: 2+ different types in 14 days multiplies the score by 1.2", () => {
  const twoTypes = [sig("funding", 6, 2), sig("new_leader", 6, 5)];
  const sameType = [sig("funding", 6, 2), sig("funding", 6, 5)];
  assert.equal(hasMomentum(twoTypes, NOW), true);
  assert.equal(hasMomentum(sameType, NOW), false);
  const raw = signalValue(twoTypes[0], NOW) + signalValue(twoTypes[1], NOW);
  assert.ok(Math.abs(accountScore(twoTypes, NOW) - raw * 1.2) < 0.01);
});

test("momentum: a second type older than 14 days does not count", () => {
  assert.equal(hasMomentum([sig("funding", 6, 2), sig("new_leader", 6, 20)], NOW), false);
});

test("quiet accounts: no signals, or only signals older than 30 days, score 0", () => {
  assert.equal(accountScore([], NOW), 0);
  assert.equal(accountScore([sig("new_leader", 10, 31), sig("funding", 10, 45)], NOW), 0);
});

test("quiet accounts fall: the same signal scores less every day it ages", () => {
  const s = [sig("headcount_expansion", 8, 0)];
  const scores = [0, 3, 7, 14, 29].map((d) => accountScore(s, new Date(NOW.getTime() + d * 86_400_000)));
  for (let i = 1; i < scores.length; i++) assert.ok(scores[i] < scores[i - 1]);
});

test("a fresh signal plus an older pattern beats a single fresh signal", () => {
  const singleFresh = [sig("headcount_expansion", 8, 0)];
  // funding 12 days ago, new HR leader 6 days ago, then the same fresh hiring news
  const pattern = [sig("funding", 7, 12), sig("new_leader", 7, 6), sig("headcount_expansion", 8, 0)];
  assert.ok(accountScore(pattern, NOW) > accountScore(singleFresh, NOW));
});

test("a much stronger fresh signal can still beat a weak old pattern", () => {
  const strongFresh = [sig("new_leader", 10, 0)];
  const weakOldPattern = [sig("other_relevant", 3, 20), sig("operational_challenge", 3, 25)];
  assert.ok(accountScore(strongFresh, NOW) > accountScore(weakOldPattern, NOW));
});

test("future-dated articles are treated as age 0, not as a bonus", () => {
  assert.equal(signalValue(sig("operational_challenge", 5, -2), NOW), 5);
});

import { heatBand, heatIndex } from "../lib/heat";

test("heat: score maps to 0-100 with bands, quiet accounts are cold", () => {
  assert.equal(heatIndex(0), 0);
  assert.equal(heatBand(heatIndex(0)), "Cold");
  assert.equal(heatBand(heatIndex(3)), "Cool");
  assert.equal(heatBand(heatIndex(8)), "Warm");
  assert.equal(heatBand(heatIndex(25)), "Hot");
  assert.ok(heatIndex(1000) <= 100);
  assert.ok(heatIndex(20) > heatIndex(10));
});

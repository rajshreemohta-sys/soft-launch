import { supabaseAdmin } from "./supabase";
import { accountScore, type ScorableSignal } from "./scoring";

// Step 5 of collect: rescore EVERY account (so fading is applied daily) and write the
// result back through update_account_signals, the only pipeline write path to accounts.

const HISTORY_DAYS = 90; // how far back "latest signal" can come from

type SignalRow = ScorableSignal & { account_id: string; summary: string; source_url: string };

async function recentSignals(): Promise<SignalRow[]> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
  const rows: SignalRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("signals")
      .select("account_id, signal_type, strength, published_at, summary, source_url")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as SignalRow[]));
    if (!data || data.length < 1000) return rows;
  }
}

// checkedIds: accounts whose news was checked in this run get last_checked_at = checkedAt;
// every other account keeps its previous last_checked_at.
export async function rescoreAll(checkedIds: Set<string>, checkedAt: Date = new Date()) {
  const db = supabaseAdmin();
  const { data: accounts, error } = await db.from("accounts").select("id, last_checked_at");
  if (error) throw error;

  const byAccount = new Map<string, SignalRow[]>();
  for (const s of await recentSignals()) {
    const list = byAccount.get(s.account_id) ?? [];
    list.push(s);
    byAccount.set(s.account_id, list);
  }

  const scores: { id: string; score: number }[] = [];
  const queue = [...(accounts ?? [])];
  const worker = async () => {
    for (let a = queue.shift(); a; a = queue.shift()) {
      const signals = byAccount.get(a.id) ?? []; // newest first
      const latest = signals[0];
      const score = accountScore(signals, checkedAt);
      const { error: rpcErr } = await db.rpc("update_account_signals", {
        p_account_id: a.id,
        p_signal_score: score,
        p_latest_signal_type: latest?.signal_type ?? null,
        p_latest_signal_summary: latest?.summary ?? null,
        p_latest_signal_date: latest ? new Date(latest.published_at).toISOString() : null,
        p_latest_signal_url: latest?.source_url ?? null,
        p_last_checked_at: checkedIds.has(a.id) ? checkedAt.toISOString() : a.last_checked_at,
      });
      if (rpcErr) throw new Error(`update_account_signals failed for ${a.id}: ${rpcErr.message}`);
      scores.push({ id: a.id, score });
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return scores;
}

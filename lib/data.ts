import "server-only";
import { supabaseAdmin, type Account } from "./supabase";
import { HOT_LIST_WINDOW_DAYS } from "./site";

// Server-side reads for the dashboard. Never import this into a client component.

export type Signal = {
  id: string;
  account_id: string;
  signal_type: string;
  strength: number;
  summary: string;
  source_url: string;
  source_title: string | null;
  source_name: string | null;
  published_at: string;
  reasoning: string | null;
};

export type PipelineRun = {
  kind: "collect" | "hotlist";
  started_at: string;
  finished_at: string | null;
  status: string;
  accounts_processed: number;
  signals_found: number;
};

export type HotListEntry = {
  rank: number;
  account: Account;
  signal: Signal; // freshest signal inside the window
};

export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabaseAdmin()
    .from("accounts")
    .select("*")
    .order("signal_score", { ascending: false })
    .order("company_name");
  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function getAccount(id: string): Promise<{ account: Account; signals: Signal[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = supabaseAdmin();
  const { data: account, error } = await db.from("accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!account) return null;
  const { data: signals, error: sErr } = await db
    .from("signals")
    .select("*")
    .eq("account_id", id)
    .order("published_at", { ascending: false });
  if (sErr) throw sErr;
  return { account: account as Account, signals: (signals ?? []) as Signal[] };
}

export async function getLastRun(kind: "collect" | "hotlist"): Promise<PipelineRun | null> {
  const { data, error } = await supabaseAdmin()
    .from("pipeline_runs")
    .select("kind, started_at, finished_at, status, accounts_processed, signals_found")
    .eq("kind", kind)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as PipelineRun | null;
}

// Freshest signal per account published inside the Hot List window.
async function freshSignalsByAccount(windowDays: number): Promise<Map<string, Signal>> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("signals")
    .select("*")
    .gte("published_at", since)
    .order("published_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, Signal>();
  for (const s of (data ?? []) as Signal[]) if (!map.has(s.account_id)) map.set(s.account_id, s);
  return map;
}

// Eligible = at least one signal in the last HOT_LIST_WINDOW_DAYS; ranked by score.
export async function getEligibleRanking(windowDays = HOT_LIST_WINDOW_DAYS): Promise<HotListEntry[]> {
  const fresh = await freshSignalsByAccount(windowDays);
  if (!fresh.size) return [];
  const accounts = (await getAccounts()).filter((a) => fresh.has(a.id));
  return accounts.map((account, i) => ({ rank: i + 1, account, signal: fresh.get(account.id)! }));
}

// What the home page shows: the saved Hot List (hot_rank set by the Hot List run) if there
// is one, otherwise a live ranking of eligible accounts.
export async function getHotList(): Promise<{ entries: HotListEntry[]; saved: boolean; eligibleCount: number }> {
  const ranking = await getEligibleRanking();
  const saved = (await getAccounts()).filter((a) => a.hot_rank !== null).sort((a, b) => a.hot_rank! - b.hot_rank!);
  if (saved.length) {
    const fresh = await freshSignalsByAccount(30);
    const entries = saved
      .filter((a) => fresh.has(a.id))
      .map((account) => ({ rank: account.hot_rank!, account, signal: fresh.get(account.id)! }));
    return { entries, saved: true, eligibleCount: ranking.length };
  }
  return { entries: ranking.slice(0, 10), saved: false, eligibleCount: ranking.length };
}

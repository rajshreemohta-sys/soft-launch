import "server-only";
import { supabaseAdmin, type Account } from "./supabase";
import { HOT_LIST_WINDOW_DAYS } from "./site";
import type { HotListEmailEntry, WarmEntry } from "./email";

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

export type SavedHotList = {
  id: string;
  created_at: string;
  subject: string;
  html: string;
  entries: HotListEmailEntry[];
  warm: WarmEntry[];
  dry_run: boolean;
  sent_at: string | null;
  error: string | null;
};

export async function getLatestHotList(): Promise<SavedHotList | null> {
  const { data, error } = await supabaseAdmin()
    .from("hotlists")
    .select("id, created_at, subject, html, entries, warm, dry_run, sent_at, error")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as SavedHotList | null;
}

// What the home page shows: the latest saved Hot List (ranks set by the Hot List run, with
// Gemini's one-line summaries) if there is one, otherwise a live ranking of eligible accounts.
export async function getHotList(): Promise<{
  entries: HotListEntry[];
  saved: SavedHotList | null;
  eligibleCount: number;
}> {
  const [ranking, accounts, latest] = await Promise.all([getEligibleRanking(), getAccounts(), getLatestHotList()]);
  const ranked = new Map(accounts.filter((a) => a.hot_rank !== null).map((a) => [a.id, a]));
  if (latest && ranked.size) {
    const entries = latest.entries
      .filter((e) => ranked.has(e.account_id))
      .map((e) => ({
        rank: e.rank,
        account: ranked.get(e.account_id)!,
        signal: {
          id: `${latest.id}-${e.rank}`,
          account_id: e.account_id,
          signal_type: e.signal_type,
          strength: 0,
          summary: e.one_line_summary,
          source_url: e.source_url,
          source_title: null,
          source_name: e.source_name,
          published_at: e.published_at,
          reasoning: null,
        },
      }));
    return { entries, saved: latest, eligibleCount: ranking.length };
  }
  return { entries: ranking.slice(0, 10), saved: null, eligibleCount: ranking.length };
}

// ---------------------------------------------------------------- analysis data

import type { CompanyProfile, Source } from "./profile";
import type { Insight } from "./insights";

export type ProfileRow = { profile: CompanyProfile; sources: Source[]; refreshed_at: string };
export type InsightRow = { insight: Insight; based_on_signal_at: string | null; generated_at: string };

export async function getProfile(accountId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("company_profiles")
    .select("profile, sources, refreshed_at")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function getInsight(accountId: string): Promise<InsightRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("account_insights")
    .select("insight, based_on_signal_at, generated_at")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data as InsightRow | null;
}

// Signals from the last N days (for dashboard charts).
export async function getRecentSignals(days: number): Promise<Signal[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("signals")
    .select("*")
    .gte("published_at", since)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Signal[];
}

// Lightweight profile fields for the accounts list (revenue and first-listed leader).
export async function getProfileSummaries(): Promise<Map<string, { revenue: string | null; leader: string | null }>> {
  const { data, error } = await supabaseAdmin().from("company_profiles").select("account_id, profile");
  if (error) throw error;
  const map = new Map<string, { revenue: string | null; leader: string | null }>();
  for (const row of (data ?? []) as { account_id: string; profile: CompanyProfile }[]) {
    const l = row.profile.leaders?.[0];
    map.set(row.account_id, { revenue: row.profile.financials?.revenue ?? null, leader: l ? `${l.name}, ${l.title}` : null });
  }
  return map;
}

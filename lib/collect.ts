import { z } from "zod";
import { fetchCompanyNews, type Article } from "./news";
import { classifyPrompt, classifySchema, type RecentSignal } from "./prompts";
import { generateJson } from "./gemini";
import { supabaseAdmin, type Account } from "./supabase";
import { SIGNAL_TYPES } from "./taxonomy";
import { rescoreAll } from "./rescore";

const NEWS_DAYS = 7;
const RECENT_SIGNAL_DAYS = 14;
const MAX_ARTICLES_PER_CALL = 40;

const eventSchema = z.object({
  article_ids: z.array(z.string()),
  about_company: z.boolean(),
  is_trigger: z.boolean(),
  duplicate_of_existing: z.boolean(),
  signal_type: z.enum(SIGNAL_TYPES),
  strength: z.number().int().min(1).max(10),
  summary: z.string(),
  reasoning: z.string(),
});
const classifyResult = z.object({ events: z.array(eventSchema) });
export type ClassifiedEvent = z.infer<typeof eventSchema>;

export type AccountResult = {
  company: string;
  fetched: number;
  newArticles: number;
  events: number;
  signalsSaved: number;
  savedSummaries: string[];
};

type Row = Pick<Account, "id" | "company_name" | "sector" | "search_terms">;

// Steps 1-4 of the collect pipeline for one account: fetch, skip seen, classify, save.
// Step 5 (rescore + write-back) runs once per run for all accounts, in runCollect.
export async function collectAccount(account: Row): Promise<AccountResult> {
  const db = supabaseAdmin();
  const result: AccountResult = { company: account.company_name, fetched: 0, newArticles: 0, events: 0, signalsSaved: 0, savedSummaries: [] };

  // 1. Fetch news
  const fetched = await fetchCompanyNews(account.search_terms, NEWS_DAYS);
  result.fetched = fetched.length;
  if (!fetched.length) return result;

  // 2. Skip articles this account has already sent to Gemini
  // (Looked up in chunks: Google News URLs are long and a single request would exceed URL limits.)
  const seenUrls = new Set<string>();
  for (let i = 0; i < fetched.length; i += 15) {
    const { data: seen, error } = await db
      .from("seen_articles")
      .select("url")
      .eq("account_id", account.id)
      .in("url", fetched.slice(i, i + 15).map((a) => a.url));
    if (error) throw new Error(`seen_articles lookup failed: ${error.message}`);
    (seen ?? []).forEach((s) => seenUrls.add(s.url));
  }
  const fresh = fetched.filter((a) => !seenUrls.has(a.url)).slice(0, MAX_ARTICLES_PER_CALL);
  result.newArticles = fresh.length;
  if (!fresh.length) return result;

  // 3. Classify all new articles in one Gemini call, with recent signals for de-duplication
  const since = new Date(Date.now() - RECENT_SIGNAL_DAYS * 86_400_000).toISOString();
  const { data: recent, error: recentErr } = await db
    .from("signals")
    .select("signal_type, summary, published_at")
    .eq("account_id", account.id)
    .gte("published_at", since)
    .order("published_at", { ascending: false });
  if (recentErr) throw recentErr;

  const withIds = fresh.map((a, i) => ({ ...a, id: `a${i + 1}` }));
  const byId = new Map(withIds.map((a) => [a.id, a]));
  const { events } = await generateJson(
    classifyPrompt({ companyName: account.company_name, sector: account.sector, articles: withIds, recentSignals: (recent ?? []) as RecentSignal[] }),
    classifySchema,
    classifyResult
  );
  result.events = events.length;

  // 4. Save one signal per new trigger event; mark every article as seen
  const triggerUrls = new Set<string>();
  const signalRows = [];
  for (const ev of events) {
    const articles = ev.article_ids.map((id) => byId.get(id)).filter((a): a is Article & { id: string } => !!a);
    if (!articles.length || !ev.about_company || !ev.is_trigger) continue;
    articles.forEach((a) => triggerUrls.add(a.url));
    if (ev.duplicate_of_existing) continue;

    // Earliest article is the source of record for the event.
    const source = [...articles].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[0];
    signalRows.push({
      account_id: account.id,
      signal_type: ev.signal_type,
      strength: ev.strength,
      summary: ev.summary,
      source_url: source.url,
      source_title: source.title,
      source_name: source.source,
      published_at: source.publishedAt,
      reasoning: ev.reasoning,
    });
  }

  if (signalRows.length) {
    const { data: saved, error } = await db
      .from("signals")
      .upsert(signalRows, { onConflict: "account_id,source_url", ignoreDuplicates: true })
      .select("summary");
    if (error) throw error;
    result.signalsSaved = saved?.length ?? 0;
    result.savedSummaries = (saved ?? []).map((s) => s.summary);
  }

  const { error: markErr } = await db.from("seen_articles").upsert(
    fresh.map((a) => ({ account_id: account.id, url: a.url, was_trigger: triggerUrls.has(a.url) })),
    { onConflict: "account_id,url", ignoreDuplicates: true }
  );
  if (markErr) throw markErr;

  return result;
}

export type CollectRunOptions = {
  companyNames?: string[]; // only these accounts
  limit?: number;          // at most this many accounts
  checkedBefore?: Date;    // only accounts not checked since this time (for batched manual runs)
  deadlineMs?: number;     // stop starting new accounts after this many ms
  onAccount?: (r: AccountResult | { company: string; error: string }) => void;
};

// Processes accounts least recently checked first, logging the run in pipeline_runs.
// One company failing never stops the run.
export async function runCollect(opts: CollectRunOptions = {}) {
  const db = supabaseAdmin();
  const started = Date.now();

  const { data: run, error: runErr } = await db.from("pipeline_runs").insert({ kind: "collect" }).select("id").single();
  if (runErr) throw runErr;

  let query = db
    .from("accounts")
    .select("id, company_name, sector, search_terms")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .order("company_name");
  if (opts.companyNames?.length) query = query.in("company_name", opts.companyNames);
  if (opts.checkedBefore) {
    query = query.or(`last_checked_at.is.null,last_checked_at.lt.${opts.checkedBefore.toISOString()}`);
  }
  if (opts.limit) query = query.limit(opts.limit);
  const { data: accounts, error: accErr } = await query;
  if (accErr) throw accErr;

  let processed = 0;
  let signalsFound = 0;
  const errors: string[] = [];
  const checkedIds = new Set<string>();
  for (const account of accounts ?? []) {
    if (opts.deadlineMs && Date.now() - started > opts.deadlineMs) break;
    try {
      const r = await collectAccount(account);
      checkedIds.add(account.id);
      signalsFound += r.signalsSaved;
      opts.onAccount?.(r);
    } catch (e) {
      const message = e instanceof Error ? e.message : JSON.stringify(e);
      errors.push(`${account.company_name}: ${message}`);
      opts.onAccount?.({ company: account.company_name, error: message });
    }
    processed++;
  }

  // 5. Rescore every account (not just those with new news) so fading applies daily.
  try {
    await rescoreAll(checkedIds);
  } catch (e) {
    errors.push(`rescore: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
  }

  // Accounts whose news was not checked in this run (stopped at the deadline, or failed).
  const remaining = (accounts?.length ?? 0) - checkedIds.size;
  await db
    .from("pipeline_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: errors.length ? "completed_with_errors" : "completed",
      accounts_processed: processed,
      signals_found: signalsFound,
      error: errors.length ? errors.join("\n").slice(0, 4000) : null,
    })
    .eq("id", run.id);

  return { runId: run.id as string, processed, remaining, signalsFound, errors };
}

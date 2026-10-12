import { z } from "zod";
import { Resend } from "resend";
import { supabaseAdmin, type Account } from "./supabase";
import { getAccounts, getEligibleRanking, getLastRun } from "./data";
import { generateJson } from "./gemini";
import { outreachPrompt, outreachSchema, type RecentSignal } from "./prompts";
import { hotListEmailHtml, hotListSubject, type HotListEmailEntry, type WarmEntry } from "./email";
import { runCollect } from "./collect";
import { HOT_LIST_WINDOW_DAYS } from "./site";

// Hot List run (CLAUDE.md section 7):
// fresh-collect if stale -> eligible accounts -> top 10 -> Gemini prompt B -> hot_rank via RPC -> email.

const HOT_LIST_SIZE = 10;
const WARM_SIZE = 3; // TODO(Rajshree): rule when fewer than 10 are eligible (default: list up to 3 "still warm")
const STALE_COLLECT_MS = 6 * 3_600_000;
const SIGNAL_CONTEXT_DAYS = 30;

const outreachResult = z.object({ one_line_summary: z.string(), outreach_angle: z.string() });

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://soft-launch-psi.vercel.app";
}

export function isDryRun(): boolean {
  return (process.env.DRY_RUN ?? "").toLowerCase() === "true";
}

export type HotListOptions = {
  dryRun?: boolean;             // build and save, but do not email
  collectDeadlineMs?: number;   // budget for the "collect first if stale" pass
  log?: (msg: string) => void;
};

export async function runHotList(opts: HotListOptions = {}) {
  const db = supabaseAdmin();
  const log = opts.log ?? (() => {});
  const dryRun = opts.dryRun ?? isDryRun();
  const now = new Date();

  const { data: run, error: runErr } = await db.from("pipeline_runs").insert({ kind: "hotlist" }).select("id").single();
  if (runErr) throw runErr;

  try {
    // 1. Collect first if the last collect is older than 6 hours, or if the morning collect
    //    stopped at its time limit before reaching every account.
    const lastCollect = await getLastRun("collect");
    const staleBefore = new Date(now.getTime() - STALE_COLLECT_MS);
    const { count: staleCount } = await db
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .or(`last_checked_at.is.null,last_checked_at.lt.${staleBefore.toISOString()}`);
    if (!lastCollect || new Date(lastCollect.finished_at!) < staleBefore || (staleCount ?? 0) > 0) {
      log(`${staleCount ?? "?"} accounts not checked in the last 6 hours; running a short collect pass first.`);
      const c = await runCollect({ checkedBefore: staleBefore, deadlineMs: opts.collectDeadlineMs ?? 120_000 });
      log(`Collect pass: ${c.processed} accounts, ${c.signalsFound} new signals.`);
    }

    // 2-3. Eligible accounts (signal in the window), ranked by score, top 10.
    const eligible = await getEligibleRanking(HOT_LIST_WINDOW_DAYS);
    const top = eligible.slice(0, HOT_LIST_SIZE);
    log(`${eligible.length} eligible accounts; building ${top.length} entries.`);

    // 4. Gemini prompt B for each.
    const since = new Date(now.getTime() - SIGNAL_CONTEXT_DAYS * 86_400_000).toISOString();
    const entries: HotListEmailEntry[] = [];
    for (const { rank, account, signal } of top) {
      const { data: signals, error } = await db
        .from("signals")
        .select("signal_type, summary, published_at")
        .eq("account_id", account.id)
        .gte("published_at", since)
        .order("published_at", { ascending: false });
      if (error) throw error;
      const out = await generateJson(
        outreachPrompt({
          companyName: account.company_name,
          sector: account.sector,
          dealStage: account.deal_stage,
          arjunNotes: account.arjun_notes, // read-only context; never written
          signals: (signals ?? []) as RecentSignal[],
        }),
        outreachSchema,
        outreachResult
      );
      entries.push({
        rank,
        account_id: account.id,
        company_name: account.company_name,
        deal_stage: account.deal_stage,
        signal_type: signal.signal_type,
        one_line_summary: out.one_line_summary.trim(),
        outreach_angle: out.outreach_angle.trim(),
        source_url: signal.source_url,
        source_name: signal.source_name,
        published_at: signal.published_at,
        score: Number(account.signal_score),
      });
      log(`  ${String(rank).padStart(2)}. ${account.company_name}: ${out.one_line_summary}`);
    }

    // "Still warm, no fresh news": next highest scores that are not eligible.
    let warm: WarmEntry[] = [];
    if (top.length < HOT_LIST_SIZE) {
      const eligibleIds = new Set(eligible.map((e) => e.account.id));
      warm = (await getAccounts())
        .filter((a: Account) => !eligibleIds.has(a.id) && Number(a.signal_score) > 0)
        .slice(0, WARM_SIZE)
        .map((a) => ({
          account_id: a.id,
          company_name: a.company_name,
          signal_type: a.latest_signal_type,
          summary: a.latest_signal_summary,
          signal_date: a.latest_signal_date,
          score: Number(a.signal_score),
        }));
    }

    // 5. Clear old ranks and angles, set the new ones (RPCs only touch system columns).
    const { error: clearErr } = await db.rpc("clear_hot_list");
    if (clearErr) throw clearErr;
    for (const e of entries) {
      const { error } = await db.rpc("set_hot_list_entry", {
        p_account_id: e.account_id,
        p_hot_rank: e.rank,
        p_outreach_angle: e.outreach_angle,
      });
      if (error) throw error;
    }

    // 6. Build, save and (unless dry run) send the email.
    const subject = hotListSubject(now, entries.length);
    const html = hotListEmailHtml({ date: now, entries, warm, windowDays: HOT_LIST_WINDOW_DAYS, appUrl: appUrl() });

    let emailId: string | null = null;
    let sendError: string | null = null;
    if (!dryRun) {
      const result = await sendEmail(subject, html);
      emailId = result.id;
      sendError = result.error;
    }

    const { data: saved, error: saveErr } = await db
      .from("hotlists")
      .insert({
        subject,
        html,
        entries,
        warm,
        dry_run: dryRun,
        sent_at: emailId ? new Date().toISOString() : null,
        email_id: emailId,
        error: sendError,
      })
      .select("id")
      .single();
    if (saveErr) throw saveErr;

    await db
      .from("pipeline_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: sendError ? "completed_with_errors" : "completed",
        accounts_processed: entries.length,
        signals_found: eligible.length,
        error: sendError,
      })
      .eq("id", run.id);

    log(dryRun ? "Dry run: email built and saved, not sent." : sendError ? `Email failed: ${sendError}` : `Email sent (id ${emailId}).`);
    return { hotlistId: saved.id as string, subject, entries, warm, dryRun, emailId, sendError };
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    await db.from("pipeline_runs").update({ finished_at: new Date().toISOString(), status: "failed", error: message }).eq("id", run.id);
    throw e;
  }
}

async function sendEmail(subject: string, html: string): Promise<{ id: string | null; error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.HOTLIST_TO_EMAIL;
  if (!key || !to) return { id: null, error: "RESEND_API_KEY or HOTLIST_TO_EMAIL is not set" };
  // Until a domain is verified, Resend's test sender only delivers to the Resend account owner.
  const from = process.env.HOTLIST_FROM_EMAIL || "ShiftSense <onboarding@resend.dev>";
  const { data, error } = await new Resend(key).emails.send({ from, to, subject, html });
  return { id: data?.id ?? null, error: error ? `${error.name}: ${error.message}` : null };
}

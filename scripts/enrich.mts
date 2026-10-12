// Researches company profiles (Gemini + Google Search) and writes AI insights.
//   npm run enrich                  -> every account missing a profile or insight (or stale)
//   npm run enrich -- --force Zepto -> redo these accounts
import { supabaseAdmin, type Account } from "../lib/supabase";
import { researchCompany, type CompanyProfile } from "../lib/profile";
import { generateInsight, insightIsStale } from "../lib/insights";

const args = process.argv.slice(2);
const force = args.includes("--force");
const names = args.filter((a) => a !== "--force");
const db = supabaseAdmin();

let q = db.from("accounts").select("*").order("signal_score", { ascending: false });
if (names.length) q = q.in("company_name", names);
const { data: accounts, error } = await q;
if (error) throw error;
const { data: profiles } = await db.from("company_profiles").select("account_id, profile, refreshed_at");
const { data: insights } = await db.from("account_insights").select("account_id, based_on_signal_at, generated_at");
const pById = new Map((profiles ?? []).map((p) => [p.account_id, p]));
const iById = new Map((insights ?? []).map((i) => [i.account_id, i]));
const PROFILE_MAX_AGE = 14 * 86_400_000;

for (const a of (accounts ?? []) as Account[]) {
  try {
    let profile = (pById.get(a.id)?.profile ?? null) as CompanyProfile | null;
    const pAge = pById.get(a.id) ? Date.now() - new Date(pById.get(a.id)!.refreshed_at).getTime() : Infinity;
    if (force || pAge > PROFILE_MAX_AGE) {
      const r = await researchCompany(a);
      profile = r.profile;
      console.log(`✓ ${a.company_name.padEnd(24)} founded ${profile.founded_year ?? "?"} | ${profile.listed ? `NSE ${profile.nse_symbol}` : profile.nse_symbol ? `parent NSE ${profile.nse_symbol}` : "unlisted"} | ${profile.financials.fiscal_year ?? "?"} revenue ${profile.financials.revenue ?? "?"} | ${profile.leaders.length} leaders | ${r.sources.length} sources`);
    }
    if (force || insightIsStale(iById.get(a.id) ?? null, a)) {
      const ins = await generateInsight(a, profile);
      console.log(`  insight: ${ins.verdict.slice(0, 110)}`);
    }
  } catch (e) {
    console.log(`✗ ${a.company_name}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
  }
}

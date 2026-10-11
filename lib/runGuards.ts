import "server-only";
import { supabaseAdmin } from "./supabase";

// The run buttons are public (Rajshree chose no passcode), so these limits stop repeated
// clicks from spamming the inbox or burning Gemini quota.

export const HOTLIST_COOLDOWN_MIN = 10;
export const HOTLIST_DAILY_CAP = 6; // manual + scheduled Hot Lists per IST day
const RUNNING_WINDOW_MIN = 5; // a run older than this without finishing is treated as dead

export async function hotListCooldownMinutesLeft(): Promise<number> {
  const since = new Date(Date.now() - HOTLIST_COOLDOWN_MIN * 60_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("pipeline_runs")
    .select("started_at")
    .eq("kind", "hotlist")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return 0;
  const elapsed = (Date.now() - new Date(data.started_at).getTime()) / 60_000;
  return Math.max(1, Math.ceil(HOTLIST_COOLDOWN_MIN - elapsed));
}

// Hot Lists built since midnight IST.
export async function hotListsToday(): Promise<number> {
  const ist = new Date(Date.now() + 330 * 60_000);
  const midnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000;
  const { count, error } = await supabaseAdmin()
    .from("pipeline_runs")
    .select("id", { count: "exact", head: true })
    .eq("kind", "hotlist")
    .gte("started_at", new Date(midnightIst).toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function collectIsRunning(): Promise<boolean> {
  const since = new Date(Date.now() - RUNNING_WINDOW_MIN * 60_000).toISOString();
  const { count, error } = await supabaseAdmin()
    .from("pipeline_runs")
    .select("id", { count: "exact", head: true })
    .eq("kind", "collect")
    .is("finished_at", null)
    .gte("started_at", since);
  if (error) throw error;
  return (count ?? 0) > 0;
}

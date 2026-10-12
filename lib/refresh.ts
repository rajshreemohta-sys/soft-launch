import { supabaseAdmin, type Account } from "./supabase";
import { researchCompany } from "./profile";

const PROFILE_MAX_AGE_MS = 14 * 86_400_000;

// Re-research the companies with the oldest (or missing) profiles, while time allows.
export async function refreshStaleProfiles(opts: { max: number; deadline: number }) {
  const db = supabaseAdmin();
  const [{ data: accounts }, { data: profiles }] = await Promise.all([
    db.from("accounts").select("*"),
    db.from("company_profiles").select("account_id, refreshed_at"),
  ]);
  const age = new Map((profiles ?? []).map((p) => [p.account_id, Date.now() - new Date(p.refreshed_at).getTime()]));
  const stale = ((accounts ?? []) as Account[])
    .map((a) => ({ a, age: age.get(a.id) ?? Infinity }))
    .filter((x) => x.age > PROFILE_MAX_AGE_MS)
    .sort((x, y) => y.age - x.age);
  const done: string[] = [];
  for (const { a } of stale.slice(0, opts.max)) {
    if (Date.now() > opts.deadline) break;
    try {
      await researchCompany(a);
      done.push(a.company_name);
    } catch {
      /* try again next run */
    }
  }
  return done;
}

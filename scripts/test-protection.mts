// Proves the pipeline can never overwrite Arjun's columns.
//   npm run test:protection              (uses Zepto)
//   npm run test:protection -- "DMart"
//
// 1. Writes a unique marker into arjun_notes and last_contact_date (through Arjun's own write path).
// 2. Runs the FULL pipeline for that account: Google News -> Gemini -> signals -> rescore -> write-back.
// 3. Checks Arjun's four columns are exactly as marked, while system columns were updated.
// 4. Attacks: a direct table update with the pipeline's key, and a pipeline-style update
//    to arjun_notes inside the database. Both must be blocked.
// 5. Restores the original values.
import { supabaseAdmin } from "../lib/supabase";
import { runCollect } from "../lib/collect";

const company = process.argv[2] ?? "Zepto";
const db = supabaseAdmin();
const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
};
const ARJUN = ["deal_stage", "arjun_notes", "last_contact_date", "relationship_read"] as const;

const { data: original, error } = await db.from("accounts").select("*").eq("company_name", company).single();
if (error || !original) throw new Error(`Account "${company}" not found: ${error?.message}`);

const stamp = new Date().toISOString();
const marker = `PROTECTION TEST MARKER ${stamp}`;
const markerDate = `2001-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`;

console.log(`\nProtection test on "${company}" at ${stamp}\n${"-".repeat(72)}`);

try {
  // 1. Plant the marker as Arjun would
  const { error: plantErr } = await db.rpc("update_arjun_fields", {
    p_account_id: original.id,
    p_deal_stage: original.deal_stage,
    p_arjun_notes: marker,
    p_last_contact_date: markerDate,
    p_relationship_read: original.relationship_read,
  });
  if (plantErr) throw plantErr;
  console.log(`Marker written: arjun_notes="${marker}", last_contact_date=${markerDate}`);

  // 2. Full pipeline
  console.log(`Running full pipeline for ${company} (news -> Gemini -> signals -> rescore all accounts -> write-back)...`);
  const run = await runCollect({ companyNames: [company] });
  console.log(`Pipeline finished: ${run.processed} account checked, ${run.signalsFound} new signals, ${run.errors.length} errors\n`);
  check("Pipeline ran without errors", run.errors.length === 0, run.errors.join("; ") || "no errors");

  // 3. Arjun's columns untouched, system columns written
  const { data: after } = await db.from("accounts").select("*").eq("id", original.id).single();
  check("arjun_notes unchanged after pipeline", after.arjun_notes === marker, `value: "${after.arjun_notes}"`);
  check("last_contact_date unchanged after pipeline", after.last_contact_date === markerDate, `value: ${after.last_contact_date}`);
  check(
    "deal_stage and relationship_read unchanged",
    after.deal_stage === original.deal_stage && after.relationship_read === original.relationship_read,
    `deal_stage=${after.deal_stage}, relationship_read="${after.relationship_read}"`
  );
  check(
    "Pipeline did write this account's system columns",
    after.last_checked_at !== null && new Date(after.last_checked_at) >= new Date(stamp),
    `last_checked_at=${after.last_checked_at}, signal_score=${after.signal_score}`
  );

  // 4a. Direct table update with the pipeline's (service role) key
  const { error: directErr } = await db.from("accounts").update({ arjun_notes: "OVERWRITTEN BY PIPELINE" }).eq("id", original.id);
  check("Direct table update from the pipeline is refused", !!directErr, directErr ? `database said: ${directErr.message}` : "update was NOT refused");

  // 4b. Pipeline-style update to arjun_notes inside the database
  const { error: guardErr } = await db.rpc("test_attempt_pipeline_write_to_arjun_notes", {
    p_account_id: original.id,
    p_value: "OVERWRITTEN BY PIPELINE",
  });
  check(
    "Database guard blocks a pipeline write to arjun_notes",
    !!guardErr && /Blocked/.test(guardErr.message),
    guardErr ? `database said: ${guardErr.message}` : "write was NOT blocked"
  );

  const { data: final } = await db.from("accounts").select(ARJUN.join(",")).eq("id", original.id).single<Record<string, unknown>>();
  check("arjun_notes still holds the marker after both attacks", final?.arjun_notes === marker, `value: "${final?.arjun_notes}"`);
} finally {
  // 5. Restore
  const { error: restoreErr } = await db.rpc("update_arjun_fields", {
    p_account_id: original.id,
    p_deal_stage: original.deal_stage,
    p_arjun_notes: original.arjun_notes,
    p_last_contact_date: original.last_contact_date,
    p_relationship_read: original.relationship_read,
  });
  console.log(restoreErr ? `\nWARNING: could not restore original values: ${restoreErr.message}` : `\nOriginal values restored.`);
}

const passed = results.filter((r) => r.pass).length;
const ok = passed === results.length;
console.log(`${"=".repeat(72)}\n${ok ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}: ${passed}/${results.length}  (${company}, ${stamp})\n${"=".repeat(72)}`);
process.exit(ok ? 0 : 1);

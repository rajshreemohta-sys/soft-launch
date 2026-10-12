import { z } from "zod";
import { generateJson } from "./gemini";
import { productContext, PRODUCT } from "./product";
import { supabaseAdmin, type Account } from "./supabase";
import type { CompanyProfile } from "./profile";
import { heatBand, heatIndex } from "./heat";

// Gemini's read on one lead: how hot, why now, how to approach, who to contact, and
// ready-to-send drafts. Arjun's stage and notes are read-only context.

export const insightSchema = z.object({
  verdict: z.string(),
  why_now: z.string(),
  approach: z.array(z.string()),
  talking_points: z.array(z.string()),
  risks: z.array(z.string()),
  best_contact: z.object({ name: z.string().nullable(), title: z.string(), why: z.string() }),
  email: z.object({ subject: z.string(), body: z.string() }),
  linkedin_note: z.string(),
});
export type Insight = z.infer<typeof insightSchema>;

const jsonSchema = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    why_now: { type: "string" },
    approach: { type: "array", items: { type: "string" } },
    talking_points: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    best_contact: {
      type: "object",
      properties: { name: { type: ["string", "null"] }, title: { type: "string" }, why: { type: "string" } },
      required: ["name", "title", "why"],
    },
    email: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } }, required: ["subject", "body"] },
    linkedin_note: { type: "string" },
  },
  required: ["verdict", "why_now", "approach", "talking_points", "risks", "best_contact", "email", "linkedin_note"],
};

type SignalLite = { signal_type: string; strength: number; summary: string; published_at: string };

function insightPrompt(a: Account, profile: CompanyProfile | null, signals: SignalLite[]): string {
  const heat = heatIndex(Number(a.signal_score));
  const sig = signals.length
    ? signals.map((s) => `- ${s.published_at.slice(0, 10)} ${s.signal_type} (strength ${s.strength}/10): ${s.summary}`).join("\n")
    : "(no trigger events in the last 30 days)";
  const leaders = profile?.leaders.length ? profile.leaders.map((l) => `${l.name}, ${l.title}`).join("; ") : "(not known)";
  return `You are a sharp B2B sales strategist helping Arjun, who sells ${PRODUCT.name}.

${productContext()}

Account: ${a.company_name} (${a.sector})
Company facts: ${profile ? `${profile.business_summary} Founded ${profile.founded_year ?? "unknown"}. ${profile.employees ? `Workforce: ${profile.employees}.` : ""} ${profile.listed ? `Listed (${profile.nse_symbol}).` : "Not listed."}` : "(not researched)"}
Known senior leaders: ${leaders}
Lead temperature: ${heatBand(heat)} (${heat}/100, from recent trigger events)
Deal stage: ${a.deal_stage ?? "outreach"}
Arjun's private notes (read-only context): ${a.arjun_notes ?? "(none)"}
Relationship read: ${a.relationship_read ?? "(none)"}

Trigger events from the last 30 days, newest first:
${sig}

Write, using only the facts above (never invent numbers, names, customers or events):
- verdict: 2 sentences. Start with the lead temperature word given above (Hot, Warm, Cool or Cold) and do not contradict it; it measures fresh news, not the relationship. Then give the single biggest reason to act now, or, if there are no recent triggers, what would make it worth contacting anyway (e.g. an active deal stage).
- why_now: 1 sentence naming the specific trigger(s) that make this the moment.
- approach: 3 short steps, in order, for how Arjun should approach this account given the deal stage.
- talking_points: 3 points tying the triggers to specific ${PRODUCT.name} capabilities.
- risks: 2 short objections or risks to prepare for.
- best_contact: the person to contact first. Use a name only if it is in the known senior leaders above; otherwise name null and give the role.
- email: from Arjun to best_contact. Subject under 9 words. Body under 130 words, plain text, no placeholders except the greeting name, specific to the trigger, one clear ask (a 20-minute call), signed "Arjun, ${PRODUCT.name}".
- linkedin_note: a LinkedIn connection note under 280 characters, warm and specific to the trigger, no links.`;
}

export async function generateInsight(a: Account, profile: CompanyProfile | null) {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: signals, error } = await db
    .from("signals")
    .select("signal_type, strength, summary, published_at")
    .eq("account_id", a.id)
    .gte("published_at", since)
    .order("published_at", { ascending: false });
  if (error) throw error;
  const insight = await generateJson(insightPrompt(a, profile, (signals ?? []) as SignalLite[]), jsonSchema, insightSchema);
  const { error: upErr } = await db.from("account_insights").upsert({
    account_id: a.id,
    insight,
    based_on_signal_at: a.latest_signal_date,
    generated_at: new Date().toISOString(),
  });
  if (upErr) throw upErr;
  return insight;
}

// An insight is stale when a newer signal has arrived since it was written, or after a week.
export function insightIsStale(row: { based_on_signal_at: string | null; generated_at: string } | null, a: Account): boolean {
  if (!row) return true;
  if (Date.now() - new Date(row.generated_at).getTime() > 7 * 86_400_000) return true;
  if (!a.latest_signal_date) return false;
  return !row.based_on_signal_at || new Date(a.latest_signal_date) > new Date(row.based_on_signal_at);
}

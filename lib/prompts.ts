import { productContext } from "./product";
import { SIGNAL_TYPES, TAXONOMY_TEXT } from "./taxonomy";
import type { Article } from "./news";

// ---------------------------------------------------------------- Prompt A: classify articles

export type RecentSignal = { signal_type: string; summary: string; published_at: string };

export function classifyPrompt(input: {
  companyName: string;
  sector: string;
  articles: (Article & { id: string })[];
  recentSignals: RecentSignal[];
}): string {
  const articles = input.articles
    .map((a) => `[${a.id}] ${a.publishedAt.slice(0, 10)} | ${a.source} | ${a.title}${a.snippet && a.snippet !== a.title ? `\n    ${a.snippet}` : ""}`)
    .join("\n");
  const recent = input.recentSignals.length
    ? input.recentSignals.map((s) => `- ${s.published_at.slice(0, 10)} ${s.signal_type}: ${s.summary}`).join("\n")
    : "(none)";

  return `You help a B2B salesperson spot trigger events: news that makes this the right week to contact a company about workforce management software.

${productContext()}

${TAXONOMY_TEXT}

Company: ${input.companyName}
Sector: ${input.sector}

Signals already recorded for this company in the last 14 days:
${recent}

New articles (id, date, source, headline, snippet):
${articles}

Instructions:
1. For each article, first decide whether it is actually about ${input.companyName}: not a namesake, not a different company with a similar name, and not a passing mention in an article about something else.
2. Group articles that describe the same real-world event into one event. Every article id must appear in exactly one event, including irrelevant ones (put those in events with about_company=false or is_trigger=false).
   Several routine announcements of the same kind in this batch (e.g. multiple hotel signings, store openings or plant announcements) are ONE event: summarise them together, e.g. "Signed 7 new hotels across India this week, including Agra and Goa."
3. If an event is the same as one already recorded above, set duplicate_of_existing=true.
4. For each event decide: is it a trigger, which type, strength 1-10, a one-sentence factual summary, and short reasoning about why it matters for workforce software.
5. Strength rubric: 9-10 = explicit, large, recent and directly about the workforce (e.g. "hiring 5,000 delivery staff", new CHRO appointed); 6-8 = clear trigger, moderate scale; 3-5 = plausible but indirect; 1-2 = weak.
   Calibrate: signing a property that opens in future is weaker (3-5) than opening one now; activity outside India is weaker than activity in India; a single small opening is 3-5.
   Not workforce_digitalisation: general IT, cloud, cybersecurity or AI infrastructure upgrades that are not about HR, attendance, scheduling or operations staff.
   Not operational_challenge: regulatory, licensing, product-quality or legal problems that are not about staff, staffing levels or labour.
6. Use only facts stated in the headlines and snippets. Never invent numbers, names or dates. If unsure whether something is a trigger, it is not.
7. For events that are not triggers, set signal_type to "other_relevant", strength to 1, and keep summary and reasoning to a few words.`;
}

export const classifySchema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          article_ids: { type: "array", items: { type: "string" } },
          about_company: { type: "boolean" },
          is_trigger: { type: "boolean" },
          duplicate_of_existing: { type: "boolean" },
          signal_type: { type: "string", enum: [...SIGNAL_TYPES] },
          strength: { type: "integer", minimum: 1, maximum: 10 },
          summary: { type: "string" },
          reasoning: { type: "string" },
        },
        required: ["article_ids", "about_company", "is_trigger", "duplicate_of_existing", "signal_type", "strength", "summary", "reasoning"],
      },
    },
  },
  required: ["events"],
} as const;

// ---------------------------------------------------------------- Prompt B: Hot List summary + outreach angle

const STAGE_GUIDANCE: Record<string, string> = {
  outreach: "a prospect Arjun has not really engaged yet: give him a reason to start a conversation",
  in_conversation: "a prospect already talking to Arjun: give him a reason to move the conversation forward",
  pilot: "a company running a pilot: give him a reason to expand the pilot",
  customer_expansion: "an existing customer: give him an upsell or rollout angle",
};

export function outreachPrompt(input: {
  companyName: string;
  sector: string;
  dealStage: string | null;
  arjunNotes: string | null;
  signals: RecentSignal[];
}): string {
  const signals = input.signals.map((s) => `- ${s.published_at.slice(0, 10)} ${s.signal_type}: ${s.summary}`).join("\n");
  const stage = input.dealStage ?? "outreach";
  return `You write short, practical sales notes for Arjun, who sells workforce management software in India.

${productContext()}

Company: ${input.companyName}
Sector: ${input.sector}
Deal stage: ${stage} (${STAGE_GUIDANCE[stage] ?? STAGE_GUIDANCE.outreach})
Arjun's private notes (read-only context): ${input.arjunNotes || "(none)"}

Trigger events from the last 30 days, newest first:
${signals}

Write:
1. one_line_summary: at most 20 words. What changed and when (use the date, e.g. "on 9 Oct"). Lead with the newest event; mention an earlier one only if it forms a pattern.
2. outreach_angle: at most 45 words. Connect the trigger, or the combined story across the events (e.g. funding, then a new HR head, then hiring), to ONE specific capability of the product, and fit the deal stage above. Write it as advice to Arjun ("Pitch...", "Offer...", "Ask..."). Plain and specific. No hype, no exclamation marks, no invented numbers, names or facts beyond the events and notes above.`;
}

export const outreachSchema = {
  type: "object",
  properties: {
    one_line_summary: { type: "string" },
    outreach_angle: { type: "string" },
  },
  required: ["one_line_summary", "outreach_angle"],
} as const;

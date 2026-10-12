import { z } from "zod";
import { generateGrounded, generateJson, type GroundingSource } from "./gemini";
import { supabaseAdmin } from "./supabase";

// Company profile: Gemini researches the company with Google Search (step 1, free text +
// sources), then a second call extracts structured facts ONLY from those notes (step 2).
// Every profile stores the resolved source URLs so each fact can be checked.

export const profileSchema = z.object({
  founded_year: z.number().int().nullable(),
  headquarters: z.string().nullable(),
  business_summary: z.string(),
  employees: z.string().nullable(),
  listed: z.boolean(),
  nse_symbol: z.string().nullable(),
  parent_company: z.string().nullable(),
  financials: z.object({
    fiscal_year: z.string().nullable(),
    revenue: z.string().nullable(),
    net_profit: z.string().nullable(),
    note: z.string().nullable(),
  }),
  leaders: z.array(z.object({ name: z.string(), title: z.string() })),
});
export type CompanyProfile = z.infer<typeof profileSchema>;
export type Source = { title: string; url: string };

const jsonSchema = {
  type: "object",
  properties: {
    founded_year: { type: ["integer", "null"] },
    headquarters: { type: ["string", "null"] },
    business_summary: { type: "string" },
    employees: { type: ["string", "null"] },
    listed: { type: "boolean" },
    nse_symbol: { type: ["string", "null"] },
    parent_company: { type: ["string", "null"] },
    financials: {
      type: "object",
      properties: {
        fiscal_year: { type: ["string", "null"] },
        revenue: { type: ["string", "null"] },
        net_profit: { type: ["string", "null"] },
        note: { type: ["string", "null"] },
      },
      required: ["fiscal_year", "revenue", "net_profit", "note"],
    },
    leaders: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, title: { type: "string" } }, required: ["name", "title"] },
    },
  },
  required: ["founded_year", "headquarters", "business_summary", "employees", "listed", "nse_symbol", "parent_company", "financials", "leaders"],
};

function researchPrompt(company: string, sector: string, searchTerms: string[]): string {
  return `Research the Indian company "${company}" (sector: ${sector}; also known in news as ${searchTerms.join(", ")}) using Google Search. Report only what your search results say, as short notes:

1. Year founded, headquarters city, one-line description of the business, approximate employee count or workforce size.
2. Is it listed on the NSE/BSE? If yes, its NSE trading symbol. If it is a brand or subsidiary of a listed parent, name the parent and the parent's NSE symbol.
3. Latest full-year financials: fiscal year, revenue (with currency and unit, e.g. Rs 1,286 crore), net profit or loss. For private companies, figures reported from regulatory filings in the news. Also find the latest annual report (PDF) or investor relations page.
4. Current senior leadership relevant to selling workforce software: CEO/MD, founders, CHRO/Head of HR, COO, CFO. Name and exact title, current as of the latest news.

If something is not found, say "not found". Do not guess.`;
}

function extractPrompt(company: string, notes: string): string {
  return `Extract facts about "${company}" from these research notes. Use ONLY what the notes state; use null when a fact is missing or marked not found. Keep money as written in the notes with currency and unit. nse_symbol is the bare NSE symbol (e.g. DMART), or the listed parent's symbol if the company is a brand or subsidiary of a listed parent, else null. employees: short, e.g. "about 8,500" or "45,000+ (incl. contract staff)". leaders: at most 6 current people with exact titles, most relevant to HR and operations first. business_summary: one sentence.

Notes:
${notes}`;
}

// Grounding sources are short-lived redirect links; resolve them to the real URL.
async function resolveSources(sources: GroundingSource[]): Promise<Source[]> {
  const resolved = await Promise.all(
    sources.slice(0, 15).map(async (s) => {
      try {
        const res = await fetch(s.uri, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) });
        const url = res.headers.get("location") ?? s.uri;
        return { title: s.title, url };
      } catch {
        return null;
      }
    })
  );
  const seen = new Set<string>();
  return resolved.filter((s): s is Source => !!s && !s.url.includes("vertexaisearch") && !seen.has(s.url) && !!seen.add(s.url));
}

export async function researchCompany(account: { id: string; company_name: string; sector: string; search_terms: string[] }) {
  const { text, sources } = await generateGrounded(researchPrompt(account.company_name, account.sector, account.search_terms));
  const profile = await generateJson(extractPrompt(account.company_name, text), jsonSchema, profileSchema);
  if (profile.nse_symbol) profile.nse_symbol = profile.nse_symbol.toUpperCase().replace(/[^A-Z0-9&-]/g, "") || null;
  const resolved = await resolveSources(sources);

  const { error } = await supabaseAdmin()
    .from("company_profiles")
    .upsert({ account_id: account.id, profile, sources: resolved, refreshed_at: new Date().toISOString() });
  if (error) throw error;
  return { profile, sources: resolved };
}

const latestYear = (s: Source) => Math.max(0, ...(s.url.match(/20\d\d/g) ?? []).map(Number));

// The most recent annual report PDF, else an investor relations page, if a source is one.
export function reportLink(sources: Source[]): Source | null {
  const pdfs = sources
    .filter((s) => /\.pdf($|\?)/i.test(s.url) && /annual|report|financial|integrated/i.test(s.url + s.title))
    .sort((a, b) => latestYear(b) - latestYear(a));
  return pdfs[0] ?? sources.find((s) => /investor|annual-report|annualreport|financials/i.test(s.url)) ?? null;
}

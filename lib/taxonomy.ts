// Trigger taxonomy (CLAUDE.md section 6). Order matters for display only.
export const SIGNAL_TYPES = [
  "headcount_expansion",
  "new_leader",
  "workforce_digitalisation",
  "funding",
  "operational_challenge",
  "other_relevant",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_LABELS: Record<SignalType, string> = {
  headcount_expansion: "Headcount expansion",
  new_leader: "New leader",
  workforce_digitalisation: "Workforce digitalisation",
  funding: "Funding",
  operational_challenge: "Operational challenge",
  other_relevant: "Other relevant",
};

export const TAXONOMY_TEXT = `Trigger types:
- headcount_expansion: the company is growing its team. Also counts: hiring drives; new plant, warehouse, store, hospital or office openings; entering new cities; large seasonal hiring.
- new_leader: a new CHRO, CPO, VP/Head of HR, VP Operations or COO joins. Also counts: promotions into these roles; leadership reshuffles in HR or operations.
- workforce_digitalisation: public intent to digitise people or operations processes. Also counts: HR tech or ERP rollouts; "digital transformation" of HR; automating attendance or rostering.
- funding: a funding round, IPO or large investment. Also counts: fresh capital earmarked for expansion; PE investment; a large debt raise for growth.
- operational_challenge: a problem the product addresses. Also counts: high attrition; staffing shortages; strikes; overtime disputes; labour law compliance pressure; service failures blamed on staffing; layoffs or restructuring; mergers or acquisitions that combine workforces.
- other_relevant: genuinely relevant to selling workforce software but fits none of the above. Low weight; use sparingly.

NOT triggers: stock price moves; analyst ratings; quarterly results with no workforce angle; product launches unrelated to the workforce; CSR news; awards; generic market or sector commentary; articles that only mention the company in passing.`;

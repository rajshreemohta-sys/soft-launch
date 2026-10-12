# Build brief: B2B Account Signal Monitor (for Arjun)

Read this whole file before writing any code. Save it in the project root as `CLAUDE.md` so it stays in context for every session.

## 0. How to work with me

- I'm an MBA student, not a professional developer. At every checkpoint, explain in plain language what you built, what I need to click or set up (in Supabase, Vercel, Google AI Studio, Resend), and how to check it works.
- Build in the phases in section 14. **Stop at the end of each phase** and wait for my go-ahead.
- Anything marked `TODO(Rajshree)` is a decision I still need to make. If you reach one, ask me instead of guessing.
- Never ask me to paste API keys into chat. Tell me which variable to put in `.env.local` and in Vercel's environment settings.

## 1. What we're building

Arjun sells a workforce management SaaS to mid-market and enterprise companies in India. He tracks about 40 accounts at different stages (outreach, in conversation, pilot, existing customer he's expanding). His problem is timing: he needs to know which accounts have a fresh trigger event that makes this the right week to reach out.

The system:
1. Watches live news for each of the 40 accounts every day.
2. Uses Gemini Flash to decide which news items are real trigger events, what type, and how strong.
3. Scores every account so fresh signals rise and quiet accounts fall.
4. Writes results back to Supabase, touching **only system columns**, never Arjun's.
5. Every Monday and Thursday morning, emails Arjun a Hot List: the top 10 accounts with signals from the last 3 days, each with a one-line summary and a Gemini-drafted outreach angle.
6. Shows everything on a dashboard deployed on Vercel.

This is my final exam project. It is graded against the original problem statement, so the hard requirements below matter more than extra features.

## 2. Hard requirements (non-negotiable)

1. **All AI tasks use Gemini Flash.** Never use the Claude API or any Anthropic SDK in this app.
2. **Deploy on Vercel** with a working public URL.
3. **Database is Supabase.**
4. **Use live external data.** The system must show real data at submission time.
5. **Never overwrite Arjun's columns:** his notes, last contact date, deal stage and relationship read. The system updates only signal-derived columns. Enforce this in the database, not just in app code (see section 5).
6. **Hot List email on Monday and Thursday mornings (IST):** top 10 accounts by signal strength from the last 3 days, each with a one-line signal summary and an outreach angle linking the trigger to Arjun's product.
7. **Quiet accounts fall down the priority list automatically.**
8. Code in a public GitHub repo, plus a Components Map (section 16).

## 3. Tech stack

- **Next.js (App Router) + TypeScript**, deployed on Vercel
- **Supabase** (Postgres) via `@supabase/supabase-js`. Use the service role key **server-side only**; never expose it to the browser.
- **Gemini Flash** via the official Google Gen AI SDK (`@google/genai`). Read the model name from the `GEMINI_MODEL` env var. Use JSON mode with a response schema, temperature around 0.2.
- **Google News RSS** for live news (free, no key). Parse with a small RSS/XML parser.
- **Resend** for the Hot List email.
- **Vercel Cron** for scheduling.
- Plain CSS with CSS variables or CSS Modules for styling. No UI component kit; the design is custom (section 12).

## 4. Arjun's product (context for every Gemini prompt)

Keep this in one config file (`lib/product.ts`) so I can edit it.

- **Product name:** `TODO(Rajshree)` (placeholder: "ShiftSense")
- **What it is:** workforce management software for mid-market and enterprise companies in India with large or frontline workforces.
- **Capabilities (assumed, editable):** shift scheduling and rostering; attendance and time tracking (biometric, geo-fenced mobile); leave and overtime management; labour law compliance reports; a mobile app for frontline staff; workforce analytics (attrition, overtime cost, staffing gaps); payroll system integration.
- **Best-fit customers:** companies with many hourly, shift-based or distributed staff, such as retail, quick commerce, logistics, hospitals, hotels, BPOs and manufacturing.

## 5. Database (Supabase)

### Tables

```sql
-- One row per account. Columns are split by OWNER.
create table accounts (
  id uuid primary key default gen_random_uuid(),

  -- Setup columns (set once at seeding; system never writes)
  company_name text not null unique,
  search_terms text[] not null,          -- e.g. {'"Delhivery"'}; quoted names reduce false matches
  sector text not null,

  -- ARJUN'S COLUMNS (system must NEVER write these)
  deal_stage text check (deal_stage in ('outreach','in_conversation','pilot','customer_expansion')),
  arjun_notes text,
  last_contact_date date,
  relationship_read text,

  -- SYSTEM COLUMNS (only the pipeline writes these, only via the RPC below)
  signal_score numeric not null default 0,
  latest_signal_type text,
  latest_signal_summary text,
  latest_signal_date timestamptz,
  latest_signal_url text,
  outreach_angle text,
  hot_rank int,                           -- 1..10 when on the current Hot List, else null
  last_checked_at timestamptz
);

-- One row per real trigger EVENT (not per article)
create table signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  signal_type text not null check (signal_type in
    ('headcount_expansion','new_leader','workforce_digitalisation','funding','operational_challenge','other_relevant')),
  strength int not null check (strength between 1 and 10),
  summary text not null,
  source_url text not null unique,
  source_title text,
  source_name text,
  published_at timestamptz not null,
  reasoning text,
  created_at timestamptz not null default now()
);

-- Every article already sent to Gemini, so we never pay to classify it twice
create table seen_articles (
  url text primary key,
  account_id uuid references accounts(id) on delete cascade,
  was_trigger boolean not null,
  checked_at timestamptz not null default now()
);

-- Run log for the dashboard ("last updated") and for debugging
create table pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('collect','hotlist')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  accounts_processed int default 0,
  signals_found int default 0,
  error text
);
```

### Protecting Arjun's columns (two layers)

**Layer 1: one write path.** The pipeline never calls `.update()` on `accounts` directly. It calls this RPC, which can only touch system columns:

```sql
create or replace function update_account_signals(
  p_account_id uuid,
  p_signal_score numeric,
  p_latest_signal_type text,
  p_latest_signal_summary text,
  p_latest_signal_date timestamptz,
  p_latest_signal_url text,
  p_outreach_angle text,
  p_hot_rank int,
  p_last_checked_at timestamptz
) returns void
language plpgsql security definer as $$
begin
  perform set_config('app.writer', 'pipeline', true);
  update accounts set
    signal_score = p_signal_score,
    latest_signal_type = p_latest_signal_type,
    latest_signal_summary = p_latest_signal_summary,
    latest_signal_date = p_latest_signal_date,
    latest_signal_url = p_latest_signal_url,
    outreach_angle = p_outreach_angle,
    hot_rank = p_hot_rank,
    last_checked_at = p_last_checked_at
  where id = p_account_id;
end $$;
```

(Split into smaller RPCs if needed, e.g. one that only updates `hot_rank`, but every RPC must follow the same rule.)

**Layer 2: a database guard.** A `BEFORE UPDATE` trigger on `accounts` that raises an error if `app.writer = 'pipeline'` and any of Arjun's columns (`deal_stage`, `arjun_notes`, `last_contact_date`, `relationship_read`) or setup columns would change. Even a buggy pipeline cannot overwrite his data.

Enable RLS on all tables. The dashboard reads through server-side code only.

### Seed data

**Done (Phase 2).** Rajshree supplied and approved the 40 companies (mix of enterprises where a trigger opens a vendor-replacement chance, and fast-scaling mid-market companies where Arjun could be the first proper system). Source of truth: `seed/accounts.json`; `node seed/build-seed-sql.mjs` regenerates `seed/seed.sql`. Sector = Rajshree's group headings. Search-term rules: "India" added for Teleperformance, Concentrix, Startek; Porter is searched as `"Porter" logistics` (never just "Porter"). Swapped after Phase 3 for thin news: Startek India → Fusion CX (outreach), Pristyn Care → Medanta (in conversation). Arjun's data refers to roles, never real people's names.

After Phase 3, report any company that returns very little news so Rajshree can swap it.

### Disclaimer (required)

Show this exact line, small and clear, in the dashboard footer, on `/how-it-works`, at the bottom of the Hot List email, and in the README:

> Demo project. Companies and news are real; Arjun, his product and all deal notes are fictional.

(Context: Mesa School of Business exam project.)

### Supabase project

Project `soft-launch`, ref `zuhslwritiysejjyrqhj`, region ap-south-1 (Mumbai). Schema in `supabase/migrations/001_init.sql`. The single RPC above was split into `update_account_signals` (collect: score + latest signal + last_checked_at), `clear_hot_list` and `set_hot_list_entry` (hot_rank + outreach_angle), so daily collects never wipe the Hot List. `service_role` has no direct INSERT/UPDATE/DELETE on `accounts`.

## 6. Trigger taxonomy

These five come from the problem statement and are the core. The examples under each tell Gemini how broadly to read them.

| Type | Meaning | Also counts |
|---|---|---|
| `headcount_expansion` | Company is growing its team | Hiring drives, new plant, warehouse, store, hospital or office openings, entering new cities, large seasonal hiring |
| `new_leader` | New CHRO, CPO, VP/Head of HR, VP Operations, COO joins | Promotions into these roles, leadership reshuffles in HR or operations |
| `workforce_digitalisation` | Public intent to digitise people or operations processes | HR tech or ERP rollouts, "digital transformation" of HR, automation of attendance or rostering |
| `funding` | Funding round, IPO, large investment | Fresh capital earmarked for expansion, PE investment, large debt raise for growth |
| `operational_challenge` | A problem Arjun's product addresses | High attrition, staffing shortages, strikes, overtime disputes, labour law compliance pressure, service failures blamed on staffing, layoffs or restructuring, mergers or acquisitions that combine workforces |
| `other_relevant` | Genuinely relevant but doesn't fit the above | Low weight; cannot carry an account to the top on its own |

Not triggers: stock price moves, product launches unrelated to workforce, CSR news, awards, generic market commentary, articles that only mention the company in passing.

## 7. Pipeline

### Collect (runs daily)

For each account, oldest `last_checked_at` first:

1. **Fetch news:** Google News RSS search for each search term combined with trigger keywords, restricted to India and the last 7 days, e.g.
   `https://news.google.com/rss/search?q=<"Company"> (hiring OR appoints OR CHRO OR funding OR expansion OR attrition OR digital) when:7d&hl=en-IN&gl=IN&ceid=IN:en`
   Run 1–2 queries per company. Collect title, link, source, published date, snippet.
   **Also The Ken** (Rajshree's request): a third Google News query `site:the-ken.com <names> when:Nd` per company. Ken articles are kept only if the company is named in the headline (its newsletters mention big names in passing). Headlines only: never log in or fetch paywalled text. The Ken's own RSS feed was checked and is not useful (10 items, no teaser).
2. **Skip anything already in `seen_articles`.**
3. **Classify with Gemini:** send all of the company's new articles in **one call**, plus summaries of its signals from the last 14 days (so Gemini can recognise repeat coverage of an event already recorded). See prompt A.
4. **Save:** one `signals` row per new trigger event (articles about the same event are merged, using the earliest/most authoritative URL). Mark every article in `seen_articles`.
5. **Rescore** the account (section 9) and write back via `update_account_signals`.

Reliability rules:
- Set `export const maxDuration = 300` on the route. Stop cleanly at about 250 seconds; the next run continues with the least recently checked accounts.
- Retry Gemini on rate-limit errors (429) with exponential backoff; space calls a few seconds apart for the free tier.
- One company failing must not stop the run. Log the error and move on.
- Record every run in `pipeline_runs`.

### Hot List (runs Monday and Thursday)

1. Run a short collect pass first if the last collect is older than 6 hours.
2. **Eligible:** accounts with at least one signal published in the last `HOT_LIST_WINDOW_DAYS` (default 3).
3. Rank eligible accounts by `signal_score`; take the top 10.
4. For each, call Gemini prompt B to write the one-line summary and outreach angle.
5. Clear old `hot_rank` values, set new ones (via RPC), save the outreach angles.
6. Send the email (section 10).

`TODO(Rajshree)`: if fewer than 10 accounts are eligible. Default for now: send only the eligible ones, then a short separate section "Still warm, no fresh news" listing up to 3 next-highest accounts, clearly marked.

## 8. Gemini prompts

Put prompts in `lib/prompts.ts`. Always request JSON with a schema and validate the response (e.g. with zod). Never let Gemini invent facts not in the articles.

### Prompt A: classify articles for one company

Inputs: product context (section 4), the trigger taxonomy (section 6 including "not triggers"), company name and sector, the list of new articles (id, title, source, date, snippet), and the company's recent signal summaries.

Instructions to include:
- First decide whether each article is actually about this company (not a namesake or passing mention).
- Group articles that describe the same event into one event.
- If an event matches one already in the recent signals, mark it as a duplicate.
- For each new event: is it a trigger, which type, strength 1–10, one-sentence factual summary, short reasoning.
- Strength rubric: 9–10 = explicit, large, recent and directly about workforce (e.g. "hiring 5,000 delivery staff", new CHRO appointed); 6–8 = clear trigger, moderate scale; 3–5 = plausible but indirect; 1–2 = weak.

Output schema:
```json
{ "events": [ {
  "article_ids": ["a1","a3"],
  "about_company": true,
  "is_trigger": true,
  "duplicate_of_existing": false,
  "signal_type": "headcount_expansion",
  "strength": 8,
  "summary": "Announced plans to hire 3,000 warehouse staff ahead of the festive season.",
  "reasoning": "Large frontline hiring creates immediate rostering and attendance load."
} ] }
```

### Prompt B: Hot List summary and outreach angle

Inputs: product context; company name and sector; the account's signals from the last 30 days (newest first); Arjun's `deal_stage` and `arjun_notes` as **read-only context** (reading is fine, writing never).

Ask for:
- `one_line_summary`: max 20 words, what changed and when.
- `outreach_angle`: max 45 words. Connect the trigger (or the combined story across signals, e.g. funding then new CHRO then hiring) to one specific product capability, and fit the deal stage: a prospect gets a reason to talk; a pilot account gets a reason to expand the pilot; a customer gets an upsell angle. Plain, specific, no hype, no invented numbers.

## 9. Scoring

Put all constants in `lib/scoring.ts` and unit-test the function.

```
signal_value = strength × type_weight × 0.5 ^ (age_days / HALF_LIFE_DAYS)
account_score = sum of signal_value over the last LOOKBACK_DAYS
              + momentum bonus
```

- `HALF_LIFE_DAYS = 7`, `LOOKBACK_DAYS = 30`
- Type weights: `new_leader 1.3`, `funding 1.2`, `headcount_expansion 1.2`, `workforce_digitalisation 1.1`, `operational_challenge 1.0`, `other_relevant 0.5`
- **Momentum bonus:** if the account has 2 or more signals of **different types** within the last 14 days, multiply the score by 1.2.
- Accounts with no signals in the lookback score 0 and fall to the bottom on their own.

Why: old and new signals combine, so a pattern (funding, then a new HR leader, then hiring) outranks a single fresh headline, while quiet accounts still fade. Hot List eligibility still requires a signal in the last 3 days, as the brief says.

Rescore **every** account on each collect run (not just those with new news) so fading is applied daily.

## 10. Hot List email

- Send with Resend. Until a domain is verified, use Resend's test sender; on the free tier that only delivers to the email address of the Resend account owner. `HOTLIST_TO_EMAIL` must be that address.
- Subject example: `Hot List for Thu 15 Oct: 7 accounts worth a call`
- Body: a short intro line, then one block per account in rank order: rank number, company, signal type tag, one-line summary, outreach angle, source link, and a link to that account on the dashboard.
- Email HTML must be table-based with inline styles. Use the palette from section 12; fonts fall back to Helvetica/Arial since most email clients won't load web fonts.
- Add a `DRY_RUN=true` mode that builds the email and shows it on the dashboard at `/hotlist/preview` without sending.

## 11. Scheduling and manual runs

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/collect", "schedule": "30 0 * * *" },
    { "path": "/api/cron/hotlist", "schedule": "30 2 * * 1,4" }
  ]
}
```
(UTC times: collect around 6:00 AM IST daily, Hot List around 8:00 AM IST Monday and Thursday. On Vercel's free plan cron timing can drift within the hour, which is fine.)

- Protect cron routes with `CRON_SECRET` (Vercel sends it as a Bearer token automatically when the env var is set).
- Add **"Run collection now"** and **"Send Hot List now"** buttons on the dashboard, protected by a simple passcode (`RUN_PASSCODE`). The collect button should keep calling the route until all accounts are processed and show progress. I need these for the live demo.

## 12. Dashboard and design

### Direction

Inspired by a calm, editorial template I liked (a Wix template called "AI Classes (Illustrative)"). **Borrow the feel only.** Do not copy its name, copy text, logo or illustrations. Make the product's own name `TODO(Rajshree)` (placeholder: "Signal Desk").

The feel: lots of white space, a centred content frame drawn with thin grey lines, small grey dots where lines cross (like a blueprint), very large tightly-spaced sans-serif headlines with small plain body text, pill-shaped buttons, a warm cream band for emphasis, and abstract geometric arc shapes in a muted four-colour palette.

### Tokens

```css
:root {
  --green: #3D6549;      /* primary buttons, headcount_expansion */
  --sage: #6E8761;       /* workforce_digitalisation */
  --terracotta: #DE8C68; /* new_leader */
  --mauve: #A3829A;      /* funding */
  --cream: #EFEBE1;      /* emphasis bands, other_relevant tag */
  --ink: #000000;        /* text, operational_challenge tag outline */
  --line: #D6D3CC;       /* grid lines and dots */
  --paper: #FFFFFF;
}
```

- **Type:** "Inter Tight" (Google Fonts) for headlines, weight 500, letter-spacing about -0.035em, line-height about 1.0, large (56–88px on desktop for page titles). "Inter" for body, 15–16px, line-height 1.5. Sentence case everywhere.
- **Grid:** a centred frame (max-width about 1120px) with 1px `--line` borders on left and right running the full page height; horizontal section dividers run edge to edge; 5px `--line` dots at the intersections.
- **Buttons:** pill-shaped. Primary = `--green` with white text. Secondary = black with white text.
- **Contrast:** use black text on terracotta, mauve, sage and cream. White text only on green and black.
- **Signal type tags:** small pills in the type colour; `operational_challenge` is a white pill with a 1px black outline; `other_relevant` is cream with a `--line` border.

### Signature element: account cards

Hot List entries are cards shaped like a browser window: 1px black border, rounded corners (about 14px), a 32px top bar filled with the signal type colour holding three small black dots on the left and the company name. Inside: the one-line summary, the outreach angle, source link, and score. A large rank number (01–10, Inter Tight) sits beside each card, since the Hot List is a ranked order.

### Pages

1. **`/` Hot List:** header (wordmark, nav, run buttons), a big headline such as "Who's worth a call this week", a cream band with the run status ("Updated Thursday 8:04 AM. 7 accounts have fresh signals."), then the ranked cards. A header composition of overlapping SVG arcs in the palette, original and generated in code.
2. **`/accounts`:** all 40 accounts in a table drawn with the grid lines. Columns: rank, company, sector, deal stage, score, latest signal tag, last signal date, last contact date. Sort by score by default; filter by stage and signal type. Quiet accounts appear greyed at the bottom.
3. **`/accounts/[id]`:** two clearly separate panels. "Arjun's notes" (deal stage, notes, last contact, relationship read) with a small note that the system never edits this panel. "What the system found" (score, signal timeline newest first with tags, summaries, source links, current outreach angle).
4. **`/how-it-works`:** the Components Map (section 16) rendered with Mermaid, plus a short plain-language explanation of triggers and scoring. Graders will look here.
5. **`/hotlist/preview`:** the latest email as it was or will be sent.

Optional, only after everything else works: let Arjun edit his own fields from the account page, through a separate endpoint that can update **only** Arjun's columns.

### Quality bar

- Responsive down to mobile (cards stack, the table scrolls sideways inside its own container).
- Visible keyboard focus, good contrast, respect reduced-motion.
- Clear empty and error states: e.g. "No fresh signals in the last 3 days. Run collection now to check again."
- Avoid: drop shadows, gradients, all-caps labels, fade-in animations on every section, arrows appended to button text, generic stock SaaS styling.

## 13. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=              # gemini-3.8-flash (2.5 Flash is closed to new keys)
RESEND_API_KEY=
HOTLIST_TO_EMAIL=          # must be my Resend account email on the free tier
CRON_SECRET=
RUN_PASSCODE=
HOT_LIST_WINDOW_DAYS=3
DRY_RUN=false
```
Provide `.env.example` with these names and no values. Make sure `.env.local` is in `.gitignore`.

## 14. Build phases (stop after each)

1. **Scaffold:** Next.js + TypeScript project, push to GitHub, deploy a placeholder page to Vercel. Checkpoint: I can open the live URL.
2. **Database:** tables, RPC, guard trigger, RLS. Draft the 40 companies for my approval, then seed. Checkpoint: I can see the rows in Supabase's table editor.
3. **News fetcher:** fetch and log articles per company, no AI yet. Checkpoint: a test route shows real recent articles for 3 companies.
4. **Gemini classification:** prompt A, saving signals and seen articles. Checkpoint: real signals appear in the `signals` table.
5. **Scoring and write-back:** scoring function with unit tests, RPC write-back, the protection test (section 15). Checkpoint: the test passes and I've watched it.
6. **Dashboard:** all pages in the design above. Checkpoint: I review it on desktop and mobile.
7. **Hot List:** prompt B, email, preview page, dry-run mode. Checkpoint: I receive a real email.
8. **Scheduling:** crons, run-now buttons with passcode. Checkpoint: crons visible in Vercel.
9. **Docs and polish:** README, Components Map, limitations. Checkpoint: final run with live data the day before submission.

## 15. Tests and proof

- **`npm run test:protection`:** writes a unique marker into one account's `arjun_notes` and `last_contact_date`, runs the full pipeline for that account, and asserts both are unchanged. Also tries a direct pipeline-style update to `arjun_notes` and asserts the database guard blocks it. Print clear pass/fail output I can screenshot.
- Unit tests for scoring: decay, type weights, momentum bonus, zero score for quiet accounts, and the "fresh signal + older pattern beats single fresh signal" case.
- A dry-run end-to-end command that runs collect and Hot List without sending email.

## 16. Deliverables

- Public GitHub repo with a clear README: what it does, setup steps, env vars, architecture, how to run tests, design decisions (scoring rationale, trigger taxonomy), and limitations.
- **Components Map** as a Mermaid diagram in the README and on `/how-it-works`, showing: Vercel Cron → collect route → Google News RSS → Gemini Flash (classify) → Supabase (`signals`, `seen_articles`, `accounts` via RPC + guard) → scoring → Hot List route → Gemini Flash (outreach) → Resend → Arjun's inbox; plus the dashboard reading from Supabase and the manual run buttons.
- **Limitations to state honestly in the README:** LinkedIn posts can't be reliably or legally scraped, so the system relies on news and press coverage, which reports the same major events (new leaders, funding, expansion). Google News RSS returns limited results per query. Gemini judgements can be wrong, so every signal links to its source.

## 17. Open decisions

- ~~Product and dashboard name~~ **Decided:** both are **ShiftSense** (the brief's product placeholder); the dashboard carries Arjun's company name.
- `TODO(Rajshree)`: Hot List rule when fewer than 10 accounts are eligible (default in section 7)
- ~~Gemini Flash model version~~ **Decided: `gemini-3.8-flash`.** Rajshree's key cannot use `gemini-2.5-flash` (Google: "no longer available to new users"). Mention this in the README.
- ~~Hot List headline~~ **Resolved:** Rajshree removed the big headline areas entirely (12 Oct); pages use a slim `.page-head` title row, the home page starts with the KPI tiles, and the email title is "Hot List · <date>".
- Known edge: with a strict 3-day window, news published Thursday after the morning email but before Friday morning is more than 3 days old by Monday's email, so it counts in the score but can't make Monday's Hot List. Keep `HOT_LIST_WINDOW_DAYS` configurable; changing it to 4 closes the gap but stretches the brief's wording.

## 18. Build log and deviations (keep updated)

- **Migration 002:** `seen_articles` primary key is `(account_id, url)` and `signals` is unique on `(account_id, source_url)`, because one article can be relevant to two accounts (e.g. "Blinkit beats Zepto").
- **Collect pipeline** lives in `lib/collect.ts`; run locally with `npm run collect` (all) or `npm run collect -- Zepto DMart`. At most 40 newest unseen articles per company per Gemini call; the rest are picked up next run.
- **Prompt A additions:** routine same-kind announcements (several hotel signings or store openings) are grouped into one event; future signings and non-India activity score lower; generic IT/cloud upgrades are not workforce_digitalisation; regulatory/product problems not about staff are not operational_challenge.
- **Gemini config:** JSON mode with `responseJsonSchema`, temperature 0.2, thinking level LOW, 4 s between calls, retries 429/5xx with backoff.
- **Known limitation:** Google News RSS returns a limited, slightly varying set per query, so an event can be missed on one run and caught on the next.
- **Phase 5:** `lib/scoring.ts` (constants + `accountScore`), unit tests in `tests/scoring.test.ts` (`npm test`). `lib/rescore.ts` rescores ALL accounts at the end of every collect run via `update_account_signals`; only accounts checked in that run get a new `last_checked_at`. `npm run rescore` rescores without fetching news.
- **Migration 003:** `update_arjun_fields` is Arjun's own write path (only his four columns, `app.writer='arjun'`); the guard now blocks both directions. `test_attempt_pipeline_write_to_arjun_notes` exists only so `npm run test:protection` can prove the guard blocks it (it always fails by design).
- **Protection test:** `npm run test:protection [-- "Company"]`, 8 checks, restores original values in a `finally` block.
- **Phase 6 (dashboard):** Next 16 has `cacheComponents` on, so every DB read sits in an async component that calls `await connection()` inside `<Suspense>`; `export const dynamic` is not allowed. Nav's active state is also behind Suspense (`usePathname` on dynamic routes). Copy that is still undecided (dashboard name, headline) lives in `lib/site.ts`. Components Map source is `lib/componentsMap.ts` (three group-to-group rows so Mermaid keeps each row left-to-right). Home shows saved `hot_rank` entries when they exist, otherwise a live ranking of eligible accounts.
- **Browser pane caveat:** when the preview pane is hidden, `requestAnimationFrame` pauses, so Suspense content never swaps in and screenshots come out blank. Not an app bug.
- **Phase 7 (Hot List):** `lib/hotlist.ts` (`runHotList`), prompt B in `lib/prompts.ts`, email in `lib/email.ts`. Migration 004 adds `hotlists` (every build, sent or dry run, with entries JSON and the HTML) and makes `clear_hot_list` also clear stale `outreach_angle`s. Home page shows the latest saved Hot List (Gemini one-line summaries) when ranks exist. `/hotlist/preview` shows the latest email in a sandboxed iframe; `/hotlist/preview/email` serves it alone. Scripts: `npm run hotlist [-- --dry-run]`, `npm run e2e:dry` (collect + Hot List, no email). Sender defaults to `onboarding@resend.dev` (override with `HOTLIST_FROM_EMAIL`); links use `APP_URL`, else Vercel's production URL.
- **Phase 8 (scheduling):** Crons: collect 6:00 and 7:00 AM IST (one run reaches ~25 accounts on Vercel in 250 s, the 7 AM run finishes the rest), Hot List Mon + Thu 8:00 AM IST. Rajshree chose to keep the brief's schedule exactly (Hot List Mon + Thu only; considered and declined a daily digest). `vercel.json` crons hit `/api/cron/collect` and `/api/cron/hotlist` (Bearer `CRON_SECRET`, generated, never typed). Buttons in the header call `POST /api/run/collect` (batches of ~45 s, `startedAt` + `checkedBefore` so it loops until every account is checked since the click) and `POST /api/run/hotlist`, with header `x-run-passcode` = `RUN_PASSCODE` (kept in sessionStorage only). Before building, the Hot List collects any account not checked in 6 h (covers a morning collect that hit its time limit).
- **No passcode (Rajshree's decision, overrides section 11):** the run buttons are public. Abuse limits instead: Send Hot List refuses within 10 min of the last Hot List; Run collection refuses while another collect is running (`lib/runGuards.ts`). `RUN_PASSCODE` is no longer used.
- **Access model (Rajshree):** everything a visitor sees or clicks is open, so the professor can test every feature without a password. Protected: all API keys (server-only), the database (RLS, no anon access), cron routes (CRON_SECRET). Public buttons are rate-limited (Hot List: 10 min gap, max 6 per IST day; collect: no overlap). Site is `noindex`. Phase 3 test route removed.
- **Phase 9 (docs):** README covers the requirements checklist, Components Map (must match `lib/componentsMap.ts`; check with the diff in the Phase 9 log), architecture, schedule, access model, protection, design decisions, setup, env vars, commands, limitations. `.env.example` is annotated. Still open: headline and dashboard name (`lib/site.ts`), product name (`lib/product.ts`). Before submission: run collection from the live dashboard, then Send Hot List now, the day before.
- **v2 redesign (Rajshree, 12 Oct):** keep light theme; signal-wave logo (`components/Logo.tsx`, original art); nav = Hot List + Accounts, with How it works and Email preview moved to the footer (kept for graders); status band removed. Home = KPI tiles (hot/warm/cool/cold), gauges, charts (`components/Charts.tsx`, plain SVG, every bar text-labelled since the muted brand palette fails colour-only CVD checks), Hot List as a horizontal carousel of boxes (Rajshree picked option B from JPEG mockups; `components/Carousel.tsx`). Account page = full analysis: `lib/profile.ts` (Gemini + Google Search grounding → notes, then JSON extraction from notes only; sources resolved and stored), `lib/insights.ts` (verdict, approach, drafts), `lib/live.ts` (Yahoo Finance price + news, `use cache` hours), `lib/heat.ts`. Drafts are never auto-sent (Rajshree chose "draft, then you press send"). Migration 005. `npm run enrich`. Cron collect refreshes up to 3 stale profiles when it finishes early.
- **Account page tabs (Rajshree, 12 Oct):** header + gauge, a 5-tile fact strip (founded, HQ, workforce, revenue, share price), then tabs Trigger · Signal analysis (renamed from "What the AI says") · Outreach drafts · Recent news · Company (financials, share price, leadership, sources), with Arjun's notes pinned beside the tabs. `components/Tabs.tsx`; open tab is kept in the URL hash (`#analysis`, `#drafts`, `#news`, `#company`).
- **Full-width layout (Rajshree, 12 Oct):** `--frame` is 1760px (was 1120). Wide screens (≥1400px) show 6 gauges and the three charts in one row; How it works pairs its sections two per row. Dead first-design CSS (hero, browser-window cards, band) removed.
- **Dark mode (12 Oct):** tokens in `:root`, dark values under `@media (prefers-color-scheme: dark) :root:not([data-theme=light])` and `:root[data-theme=dark]`; `components/ThemeToggle.tsx` saves the choice in localStorage and an inline head script applies it before paint. Dark heat ramp runs dark→bright (hottest brightest). SVG marks take colours via `style` so CSS vars work; Mermaid re-renders on `themechange`. The email stays light.
- **12 Oct, Rajshree's picks:** "Hottest right now" is a temperature ladder (`components/TemperatureLadder.tsx`, top 8); the accounts page is an active table (accounts with a trigger in 30 days) plus quiet-account tiles (stage, last contact, revenue, first leader), quiet ones ordered pilot → customer expansion → in conversation → outreach. All 40 still shown, as the brief requires. Terracotta removed everywhere: heat scale is neutral → amber → orange → red (`--heat-*`), the "New leader" tag and logo use `--blue` (#4F78A8). "Open analysis" on Hot List boxes is an outlined pill button. Site name is ShiftSense.
- **12 Oct, round 2:** Hot is green, not red (Rajshree: red reads as danger). Light heat scale grey → yellow-green → green → deep green; dark uses neon green for hot. Dark mode has a neon look after Rajshree's DCYB Dribbble reference: near-black warm background, cyber-orange (`--neon` #FF5A1F) glow on active nav, active tab, primary buttons and hovered cards, faint orange/purple ambient light. Glow hooks use `--glow` (none in light). KPI tiles are links: Hot/Warm/Cool/Cold → `/accounts?temp=…`, new triggers → `/accounts?sort=recent`, next email → `/hotlist/preview`. Company tabs are a segmented control. Annual report / investor relations is a filled button.
- **Outreach To field (12 Oct):** the email draft has a To field (validated, remembered per company in localStorage on that device). "Send with Gmail" / "Send with mail app" open a ready-to-send message with the recipient filled in, sent from the user's own account. Server-side sending to third parties is deliberately not built: the site is public (would be an open relay), Resend's test sender only reaches the owner, and the product is fictional. Revisit only with a verified domain plus a sign-in.
- **Outreach Send (Rajshree, 12 Oct): real sending, test recipients only.** `POST /api/outreach/send` (`lib/outreach.ts`) sends via Resend after checking `x-send-passcode` = `SEND_PASSCODE` (the only passcode on the public site), recipient ∈ `OUTREACH_TEST_RECIPIENTS` (default `HOTLIST_TO_EMAIL`), and ≤ 10 sends per IST day; every attempt is logged in `outreach_sends` (migration 006). Emails carry the demo disclaimer. "Open in Gmail" remains for anyone else. Adding teammates as recipients needs a verified Resend domain (`OUTREACH_FROM_EMAIL`).
- **LinkedIn links (12 Oct):** name + full company returned no results on LinkedIn (all keywords must match). Now: LinkedIn people search by name only, plus a "Web" link (Google, `site:linkedin.com/in "Name" <company core>`) via `lib/linkedin.ts`. Never scraped; the automated browser hits Google's robot check, so links were verified by URL only.

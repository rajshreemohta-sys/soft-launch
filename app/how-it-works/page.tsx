import type { Metadata } from "next";
import { Mermaid } from "@/components/Mermaid";
import { SignalTag } from "@/components/Tag";
import { COMPONENTS_MAP } from "@/lib/componentsMap";
import { PRODUCT } from "@/lib/product";
import { HALF_LIFE_DAYS, LOOKBACK_DAYS, MOMENTUM_MULTIPLIER, MOMENTUM_WINDOW_DAYS, TYPE_WEIGHTS } from "@/lib/scoring";
import { HOT_LIST_WINDOW_DAYS, SITE } from "@/lib/site";
import { SIGNAL_TYPES } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "How it works" };

const MEANINGS: Record<string, string> = {
  headcount_expansion: "Hiring drives; new plants, warehouses, stores, hospitals or offices; entering new cities.",
  new_leader: "A new CHRO, Head of HR, VP Operations or COO, or a reshuffle in HR or operations.",
  workforce_digitalisation: "HR tech or ERP rollouts, or plans to automate attendance and rostering.",
  funding: "A funding round, IPO, PE investment or a large debt raise for growth.",
  operational_challenge: "Attrition, staff shortages, strikes, overtime disputes, labour compliance pressure, layoffs or mergers.",
  other_relevant: "Relevant but fits none of the above. Low weight; cannot top the list alone.",
};

export default function HowItWorksPage() {
  return (
    <>
      <section className="page-head">
        <h1 className="page-title">How it works</h1>
        <p className="muted small">
          Every morning the system reads the news for 40 accounts, asks Gemini Flash which items are real trigger events
          for {PRODUCT.name}, scores every account, and twice a week emails Arjun the ten worth a call.
        </p>
      </section>
      <div className="rule" />

      <section className="section">
        <h2 className="display" style={{ marginBottom: 24 }}>Components map</h2>
        <Mermaid chart={COMPONENTS_MAP} label="Components map: Vercel Cron triggers the collect route, which reads Google News, classifies with Gemini Flash, saves to Supabase, scores accounts and writes back through a guarded RPC. Twice a week the Hot List route asks Gemini Flash for outreach angles and emails Arjun through Resend. The dashboard reads from Supabase." />
      </section>
      <div className="rule" />
      <div className="how-grid">

      <section className="section how-cell">
        <div className="prose">
          <h2 className="display">1. Collect, every day at 6 AM</h2>
          <ul>
            <li>For each account, search Google News (India, last 7 days) for its name plus trigger words like hiring, appoints, funding, expansion and attrition. The Ken&rsquo;s headlines are searched too.</li>
            <li>Skip any article this account has already sent to Gemini.</li>
            <li>Send all new articles for one company to Gemini Flash in a single call. It checks each article is really about the company, groups articles about the same event, ignores events already recorded, and labels each real trigger with a type and a strength from 1 to 10.</li>
            <li>Save one signal per new event, with its source link, so every claim can be checked.</li>
          </ul>
        </div>
      </section>

      <section className="section how-cell">
        <h2 className="display" style={{ marginBottom: 24 }}>2. What counts as a trigger</h2>
        <div className="table-scroll">
          <table className="table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Means</th>
                <th className="num">Weight</th>
              </tr>
            </thead>
            <tbody>
              {SIGNAL_TYPES.map((t) => (
                <tr key={t}>
                  <td><SignalTag type={t} /></td>
                  <td>{MEANINGS[t]}</td>
                  <td className="num">{TYPE_WEIGHTS[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 16, maxWidth: "68ch" }}>
          Not triggers: share price moves, analyst ratings, results with no workforce angle, unrelated product launches,
          CSR, awards, sector commentary, and passing mentions.
        </p>
      </section>

      <section className="section how-cell">
        <div className="prose">
          <h2 className="display">3. Scoring</h2>
          <p className="formula">{`signal value  = strength × type weight × 0.5 ^ (age in days ÷ ${HALF_LIFE_DAYS})
account score = sum of signal values from the last ${LOOKBACK_DAYS} days
                × ${MOMENTUM_MULTIPLIER} if 2+ different signal types in the last ${MOMENTUM_WINDOW_DAYS} days`}</p>
          <ul>
            <li><strong>Fresh news rises, quiet accounts fall.</strong> A signal loses half its value every {HALF_LIFE_DAYS} days. Every account is rescored daily, so an account with no new news drifts down on its own and reaches zero after {LOOKBACK_DAYS} days.</li>
            <li><strong>Patterns beat single headlines.</strong> Signals add up, and two or more different types in {MOMENTUM_WINDOW_DAYS} days (say, funding then a new HR head) earn a {MOMENTUM_MULTIPLIER}&times; momentum bonus.</li>
            <li><strong>The Hot List needs fresh news.</strong> Only accounts with a signal from the last {HOT_LIST_WINDOW_DAYS} days are eligible; among them, the top ten by score make the email.</li>
          </ul>
        </div>
      </section>

      <section className="section how-cell">
        <div className="prose">
          <h2 className="display">4. Arjun&rsquo;s columns are protected</h2>
          <p>
            Arjun&rsquo;s deal stage, notes, last contact date and relationship read are never written by the system. This is
            enforced in the database, not just in code:
          </p>
          <ul>
            <li>The pipeline&rsquo;s database key has no permission to edit the accounts table directly.</li>
            <li>It can only call write functions that name system columns (score, latest signal, Hot List rank, outreach angle).</li>
            <li>A database trigger rejects any pipeline write that would change Arjun&rsquo;s columns, even if the code had a bug.</li>
          </ul>
          <p className="muted small">An automated test (<code>npm run test:protection</code>) plants a marker in Arjun&rsquo;s notes, runs the full pipeline, attempts two overwrites, and checks the marker survives.</p>
        </div>
      </section>

      <section className="section how-cell">
        <div className="prose">
          <h2 className="display">5. Account analysis</h2>
          <ul>
            <li><strong>Lead temperature.</strong> Each account&rsquo;s score maps to a 0&ndash;100 meter: Hot, Warm, Cool or Cold.</li>
            <li><strong>Company facts.</strong> Gemini Flash researches each company with Google Search (founding year, headquarters, listing, latest financials, annual report, senior leadership), then a second call extracts only what the search results say. Every profile keeps its sources. Profiles refresh every two weeks.</li>
            <li><strong>Share price.</strong> Six months of NSE prices from Yahoo Finance for listed companies or their listed parent.</li>
            <li><strong>What the AI says.</strong> Gemini Flash reads the triggers, the company facts and Arjun&rsquo;s notes (read-only) and writes the verdict, how to approach, talking points, risks and who to contact first, with an email and a LinkedIn note. It refreshes when a new trigger arrives.</li>
            <li><strong>Nothing is sent automatically.</strong> Drafts open in Gmail or the mail app, or copy for LinkedIn; Arjun reviews and sends them himself. LinkedIn is linked by search, never scraped.</li>
          </ul>
        </div>
      </section>

      <section className="section how-cell">
        <div className="prose">
          <h2 className="display">Limitations</h2>
          <ul>
            <li>LinkedIn can&rsquo;t be reliably or legally scraped, so the system relies on news and press coverage, which reports the same big events.</li>
            <li>Google News RSS returns a limited, slightly varying set of results, so an event can be missed one day and caught the next.</li>
            <li>The Ken is read through its public headlines only; paywalled articles are never fetched.</li>
            <li>Gemini can misjudge an article or a search result, so every signal and company profile links to its sources. Check leaders&rsquo; names before contacting anyone.</li>
            <li>Private companies publish no balance sheet; their figures come from filings reported in the news.</li>
            <li>Google closed Gemini 2.5 Flash to new API keys, so the app runs on Gemini 3.8 Flash (set by one environment variable).</li>
            <li>Vercel&rsquo;s free plan runs scheduled jobs within the hour, and one run can check about 25 accounts in its time limit, so a second morning run finishes the rest.</li>
          </ul>
          <p className="small muted">{SITE.disclaimer}</p>
        </div>
      </section>
      </div>
    </>
  );
}

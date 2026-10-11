// The Components Map (CLAUDE.md section 16). Shown on /how-it-works and copied into the README.
// Rows connect group-to-group so Mermaid keeps each row left-to-right.
export const COMPONENTS_MAP = `flowchart TB
  subgraph collect["1 · Collect: daily 6 AM IST, or Run collection now"]
    direction LR
    cron1["Vercel Cron / button"] --> collectRoute["/api/cron/collect"] --> rss["Google News RSS<br/>+ The Ken"] --> gem1["Gemini Flash<br/>classify triggers"] --> score["Scoring<br/>decay · weight · momentum"]
  end

  subgraph db["2 · Supabase (Postgres, RLS on)"]
    direction LR
    signals[("signals")] ~~~ seen[("seen_articles")] ~~~ rpc["Write RPCs<br/>system columns only"] --> guard{{"Guard trigger<br/>blocks Arjun's columns"}} --> accounts[("accounts")]
  end

  subgraph hot["3 · Hot List: Mon + Thu 8 AM IST, or Send Hot List now"]
    direction LR
    cron2["Vercel Cron / button"] --> hotRoute["/api/cron/hotlist"] --> gem2["Gemini Flash<br/>summary + outreach angle"] --> resend["Resend"] --> inbox(["Arjun's inbox"])
  end

  dash["Dashboard on Vercel<br/>reads Supabase server-side"]

  collect -- "signals, seen articles,<br/>scores via RPC" --> db
  db -- "top 10 eligible accounts;<br/>angles saved via RPC" --> hot
  db --> dash`;

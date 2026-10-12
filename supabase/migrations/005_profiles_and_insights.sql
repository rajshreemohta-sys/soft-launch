-- Company analysis for the account page. System-owned; Arjun's columns are untouched.
-- company_profiles: researched facts (Gemini + Google Search), with resolved source URLs.
-- account_insights: Gemini's read on the lead, approach and outreach drafts.

create table company_profiles (
  account_id uuid primary key references accounts(id) on delete cascade,
  profile jsonb not null,
  sources jsonb not null default '[]'::jsonb,   -- [{title, url}]
  refreshed_at timestamptz not null default now()
);

create table account_insights (
  account_id uuid primary key references accounts(id) on delete cascade,
  insight jsonb not null,
  based_on_signal_at timestamptz,               -- newest signal the insight saw
  generated_at timestamptz not null default now()
);

alter table company_profiles enable row level security;
alter table account_insights enable row level security;
revoke all on company_profiles, account_insights from anon, authenticated;

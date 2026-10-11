-- Every Hot List build (sent or dry run), so /hotlist/preview can show the email
-- and the home page can show Gemini's one-line summaries.
create table hotlists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  subject text not null,
  html text not null,
  entries jsonb not null,        -- [{rank, account_id, company_name, signal_type, one_line_summary, outreach_angle, source_url, source_name, published_at, score}]
  warm jsonb not null default '[]'::jsonb, -- "Still warm, no fresh news" accounts
  dry_run boolean not null,
  sent_at timestamptz,
  email_id text,
  error text
);
create index hotlists_created_idx on hotlists (created_at desc);

alter table hotlists enable row level security;
revoke all on hotlists from anon, authenticated;

-- An account that drops off the Hot List also loses its now-stale outreach angle.
create or replace function clear_hot_list() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'pipeline', true);
  update accounts set hot_rank = null, outreach_angle = null
  where hot_rank is not null or outreach_angle is not null;
end $$;

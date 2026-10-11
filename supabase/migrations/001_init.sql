-- Signal monitor schema: tables, write-path RPCs, guard trigger, RLS.
-- Arjun's columns (deal_stage, arjun_notes, last_contact_date, relationship_read)
-- are protected by three layers:
--   1. The pipeline has no direct UPDATE privilege on accounts; it can only call the RPCs below.
--   2. The RPCs only name system columns.
--   3. A BEFORE UPDATE trigger rejects any pipeline write that would change Arjun's or setup columns.

-- ---------------------------------------------------------------- tables

create table accounts (
  id uuid primary key default gen_random_uuid(),

  -- Setup columns (set once at seeding; system never writes)
  company_name text not null unique,
  search_terms text[] not null,
  sector text not null,

  -- ARJUN'S COLUMNS (system must NEVER write these)
  deal_stage text check (deal_stage in ('outreach','in_conversation','pilot','customer_expansion')),
  arjun_notes text,
  last_contact_date date,
  relationship_read text,

  -- SYSTEM COLUMNS (only the pipeline writes these, only via the RPCs below)
  signal_score numeric not null default 0,
  latest_signal_type text,
  latest_signal_summary text,
  latest_signal_date timestamptz,
  latest_signal_url text,
  outreach_angle text,
  hot_rank int check (hot_rank between 1 and 10),
  last_checked_at timestamptz
);

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
create index signals_account_published_idx on signals (account_id, published_at desc);

create table seen_articles (
  url text primary key,
  account_id uuid references accounts(id) on delete cascade,
  was_trigger boolean not null,
  checked_at timestamptz not null default now()
);
create index seen_articles_account_idx on seen_articles (account_id);

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

-- ---------------------------------------------------------------- RLS + privileges
-- RLS on, no policies: the browser (anon key) can read nothing. The dashboard reads
-- server-side with the service role key.

alter table accounts enable row level security;
alter table signals enable row level security;
alter table seen_articles enable row level security;
alter table pipeline_runs enable row level security;

revoke all on accounts, signals, seen_articles, pipeline_runs from anon, authenticated;

-- The pipeline may read accounts but never insert, update or delete them directly.
revoke insert, update, delete, truncate on accounts from service_role;
grant select on accounts to service_role;

-- ---------------------------------------------------------------- guard trigger

create or replace function guard_account_columns() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.writer', true), '') = 'pipeline' and (
       new.deal_stage        is distinct from old.deal_stage
    or new.arjun_notes       is distinct from old.arjun_notes
    or new.last_contact_date is distinct from old.last_contact_date
    or new.relationship_read is distinct from old.relationship_read
    or new.company_name      is distinct from old.company_name
    or new.search_terms      is distinct from old.search_terms
    or new.sector            is distinct from old.sector
  ) then
    raise exception 'Blocked: the pipeline tried to change Arjun''s or setup columns on account %', old.id
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger accounts_guard
  before update on accounts
  for each row execute function guard_account_columns();

-- ---------------------------------------------------------------- write-path RPCs
-- Split so a daily collect run never clears the Hot List, and the Hot List run
-- never touches scores.

-- Collect run: score and latest-signal fields.
create or replace function update_account_signals(
  p_account_id uuid,
  p_signal_score numeric,
  p_latest_signal_type text,
  p_latest_signal_summary text,
  p_latest_signal_date timestamptz,
  p_latest_signal_url text,
  p_last_checked_at timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'pipeline', true);
  update accounts set
    signal_score = p_signal_score,
    latest_signal_type = p_latest_signal_type,
    latest_signal_summary = p_latest_signal_summary,
    latest_signal_date = p_latest_signal_date,
    latest_signal_url = p_latest_signal_url,
    last_checked_at = p_last_checked_at
  where id = p_account_id;
end $$;

-- Hot List run: clear all ranks before setting the new list.
create or replace function clear_hot_list() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'pipeline', true);
  update accounts set hot_rank = null where hot_rank is not null;
end $$;

-- Hot List run: rank and outreach angle for one account.
create or replace function set_hot_list_entry(
  p_account_id uuid,
  p_hot_rank int,
  p_outreach_angle text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'pipeline', true);
  update accounts set
    hot_rank = p_hot_rank,
    outreach_angle = p_outreach_angle
  where id = p_account_id;
end $$;

revoke execute on function update_account_signals(uuid, numeric, text, text, timestamptz, text, timestamptz) from public, anon, authenticated;
revoke execute on function clear_hot_list() from public, anon, authenticated;
revoke execute on function set_hot_list_entry(uuid, int, text) from public, anon, authenticated;
revoke execute on function guard_account_columns() from public, anon, authenticated;
grant execute on function update_account_signals(uuid, numeric, text, text, timestamptz, text, timestamptz) to service_role;
grant execute on function clear_hot_list() to service_role;
grant execute on function set_hot_list_entry(uuid, int, text) to service_role;

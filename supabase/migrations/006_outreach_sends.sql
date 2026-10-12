-- Every outreach email sent from the dashboard (demo: approved test recipients only).
create table outreach_sends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  recipient text not null,
  subject text not null,
  sent_at timestamptz not null default now(),
  email_id text,
  error text
);
create index outreach_sends_sent_idx on outreach_sends (sent_at desc);

alter table outreach_sends enable row level security;
revoke all on outreach_sends from anon, authenticated;

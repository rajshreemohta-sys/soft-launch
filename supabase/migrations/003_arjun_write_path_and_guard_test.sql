-- 1. Arjun's own write path: can change ONLY his four columns.
-- 2. The guard now works both ways: pipeline writes cannot touch Arjun's/setup columns,
--    and Arjun's writes cannot touch system/setup columns.
-- 3. A test-only function that deliberately attempts a pipeline-style write to arjun_notes,
--    so `npm run test:protection` can prove the guard blocks it. It always fails by design.

create or replace function guard_account_columns() returns trigger
language plpgsql set search_path = public as $$
declare
  writer text := coalesce(current_setting('app.writer', true), '');
  setup_changed boolean := new.company_name is distinct from old.company_name
    or new.search_terms is distinct from old.search_terms
    or new.sector is distinct from old.sector;
  arjun_changed boolean := new.deal_stage is distinct from old.deal_stage
    or new.arjun_notes is distinct from old.arjun_notes
    or new.last_contact_date is distinct from old.last_contact_date
    or new.relationship_read is distinct from old.relationship_read;
  system_changed boolean := new.signal_score is distinct from old.signal_score
    or new.latest_signal_type is distinct from old.latest_signal_type
    or new.latest_signal_summary is distinct from old.latest_signal_summary
    or new.latest_signal_date is distinct from old.latest_signal_date
    or new.latest_signal_url is distinct from old.latest_signal_url
    or new.outreach_angle is distinct from old.outreach_angle
    or new.hot_rank is distinct from old.hot_rank
    or new.last_checked_at is distinct from old.last_checked_at;
begin
  if writer = 'pipeline' and (arjun_changed or setup_changed) then
    raise exception 'Blocked: the pipeline tried to change Arjun''s or setup columns on account %', old.id
      using errcode = '42501';
  end if;
  if writer = 'arjun' and (system_changed or setup_changed) then
    raise exception 'Blocked: an Arjun edit tried to change system or setup columns on account %', old.id
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function update_arjun_fields(
  p_account_id uuid,
  p_deal_stage text,
  p_arjun_notes text,
  p_last_contact_date date,
  p_relationship_read text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'arjun', true);
  update accounts set
    deal_stage = p_deal_stage,
    arjun_notes = p_arjun_notes,
    last_contact_date = p_last_contact_date,
    relationship_read = p_relationship_read
  where id = p_account_id;
end $$;

create or replace function test_attempt_pipeline_write_to_arjun_notes(
  p_account_id uuid,
  p_value text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'pipeline', true);
  update accounts set arjun_notes = p_value where id = p_account_id;
end $$;

revoke execute on function update_arjun_fields(uuid, text, text, date, text) from public, anon, authenticated;
revoke execute on function test_attempt_pipeline_write_to_arjun_notes(uuid, text) from public, anon, authenticated;
grant execute on function update_arjun_fields(uuid, text, text, date, text) to service_role;
grant execute on function test_attempt_pipeline_write_to_arjun_notes(uuid, text) to service_role;

-- MGames 2026 — row-level security and realtime.
--
-- The access model is deliberately binary (see the spec's Auth section):
-- anonymous visitors read everything; ANY authenticated session — everyone
-- shares one coordinator credential — may write the things that change during
-- the event. There are no per-coordinator accounts and no per-sport scoping,
-- so there is no audit trail if the shared password leaks; that tradeoff was
-- accepted knowingly.

alter table sports        enable row level security;
alter table categories    enable row level security;
alter table groups        enable row level security;
alter table teams         enable row level security;
alter table venues        enable row level security;
alter table courts        enable row level security;
alter table fixtures      enable row level security;
alter table vendors       enable row level security;
alter table menu_items    enable row level security;
alter table announcements enable row level security;

-- ------------------------------------------------------- public reads -----

create policy "public read" on sports        for select to anon, authenticated using (true);
create policy "public read" on categories    for select to anon, authenticated using (true);
create policy "public read" on groups        for select to anon, authenticated using (true);
create policy "public read" on teams         for select to anon, authenticated using (true);
create policy "public read" on venues        for select to anon, authenticated using (true);
create policy "public read" on courts        for select to anon, authenticated using (true);
create policy "public read" on fixtures      for select to anon, authenticated using (true);
create policy "public read" on vendors       for select to anon, authenticated using (true);
create policy "public read" on menu_items    for select to anon, authenticated using (true);
create policy "public read" on announcements for select to anon, authenticated using (true);

-- ------------------------------------------------- coordinator writes -----

-- The day-of job: push scores and flip status as matches run. Update only —
-- the fixture list itself is built ahead of the event, not from a phone.
create policy "coordinators update fixtures"
  on fixtures for update to authenticated
  using (true) with check (true);

-- Announcements are the other live surface (delays, room changes). The spec
-- lists only fixture writes explicitly; without insert here the feed could
-- never be posted to from the app, so coordinators get full control of it.
create policy "coordinators insert announcements"
  on announcements for insert to authenticated with check (true);

create policy "coordinators update announcements"
  on announcements for update to authenticated
  using (true) with check (true);

create policy "coordinators delete announcements"
  on announcements for delete to authenticated using (true);

-- Everything else (sports, teams, courts, vendors, menus) is set up before the
-- event through the Supabase dashboard or a seed script, both of which bypass
-- RLS via the service role. No client-facing write policy is intentional.

-- ----------------------------------------------------------- realtime -----

-- Only the two tables that change during the event are published. Postgres
-- errors if a table is already a member, so add each one defensively.
do $$
begin
  begin
    alter publication supabase_realtime add table fixtures;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table announcements;
  exception when duplicate_object then null;
  end;
end;
$$;

-- Realtime UPDATE payloads carry only the primary key in `old_record` unless
-- the table replicates full rows. The schedule reconciles by id, so default
-- replica identity is enough — raise to `full` only if a diff is ever needed.

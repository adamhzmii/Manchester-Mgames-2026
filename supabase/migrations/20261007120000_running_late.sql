-- Running late: what a game's real kick-off and final whistle were, how late a
-- coordinator expects one to start, and every coordinator able to edit every
-- sport.
--
-- Additive for the site that is already deployed: the new columns start
-- empty, and nothing in it reads them.

-- ------------------------------------------------------------- columns ----

alter table fixtures
  -- Stamped by the trigger below as a coordinator taps Start game and Final
  -- whistle, and correctable by hand when someone taps late.
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  -- "Starting late": minutes a coordinator expects kick-off to slip, set
  -- before the game starts.
  add column if not exists delay_minutes integer not null default 0
    constraint fixtures_delay_minutes_range check (delay_minutes between 0 and 240),
  -- The slip followers were last told about, so each slip is announced once
  -- rather than on every save.
  add column if not exists delay_notified_minutes integer not null default 0;

-- --------------------------------------------------------- time stamps ----

-- In the database rather than the app, so a status changed anywhere — the
-- scorer, the dashboard, the pre-event reset — keeps the times consistent.
create or replace function stamp_fixture_times()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'live' then
      -- Kick-off, unless this same update sets the time itself. A reopened
      -- game keeps the kick-off it already had.
      if new.started_at is not distinct from old.started_at and old.status = 'upcoming' then
        new.started_at = now();
      end if;
      new.finished_at = null;
    elsif new.status = 'finished' then
      if new.finished_at is not distinct from old.finished_at then
        new.finished_at = now();
      end if;
    elsif new.status = 'upcoming' then
      -- Reset: it has not started after all.
      new.started_at = null;
      new.finished_at = null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists fixtures_stamp_times on fixtures;

create trigger fixtures_stamp_times
  before update on fixtures
  for each row
  execute function stamp_fixture_times();

-- ------------------------------------------------- coordinators: all sports

-- Coordinators were each tied to one sport. On the day they cover for each
-- other, so every coordinator account can now edit every game — a scorer at
-- the next court, moving a game, marking it late. The boundary that remains
-- is the important one: only coordinators write, never visitors.
drop policy if exists "coordinators update fixtures in their own sport" on fixtures;
drop policy if exists "coordinators update fixtures" on fixtures;

create policy "coordinators update fixtures"
  on fixtures for update to authenticated
  using (is_coordinator())
  with check (is_coordinator());

-- Delays, second version: a coordinator sets the time a game will start,
-- rather than "+10 minutes".
--
-- "+10" read differently to different people — ten on top of what the site
-- already shows, or ten after the printed time? — so it becomes the one thing
-- a coordinator actually knows: "it starts at 10:05". Later games on the
-- court move with it, as the site works out (src/lib/delays.ts).
--
-- Additive for the site already deployed: it never reads planned_start, and
-- delay_minutes stays where it is until that version is gone.

alter table fixtures
  add column if not exists planned_start timestamptz;

-- Never before the printed time: players may not be there yet. A game moved
-- to a new official time has its planned start cleared by the app, so this
-- holds after a move too.
alter table fixtures
  drop constraint if exists fixtures_planned_start_not_early;
alter table fixtures
  add constraint fixtures_planned_start_not_early
    check (planned_start is null or planned_start >= scheduled_time);

-- ----------------------------------------------------- background checks ----

-- Followers are told when their game slips 10+ minutes. A slip can happen
-- with nobody saving anything — the game simply has not started — so the
-- check also runs in the background, piggybacking on the live feed's
-- requests. This row is how one request claims a run, so a crowd polling at
-- once does not check (or notify) a hundred times. Service role only: RLS on,
-- no policies.
create table if not exists job_claims (
  name text primary key,
  ran_at timestamptz not null default '-infinity'
);

alter table job_claims enable row level security;

insert into job_claims (name) values ('late-check')
  on conflict (name) do nothing;

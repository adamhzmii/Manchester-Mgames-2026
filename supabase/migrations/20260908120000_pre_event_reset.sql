-- MGames 2026 — rewind the seeded day back to before the first whistle.
--
-- seed.sql deliberately loads a mid-tournament snapshot (37 played, 2 live) so
-- every screen has something to render. That is the wrong starting point for a
-- dry run with the committee, where the point is to walk the day forward from
-- nothing.
--
-- Defined as a function rather than a one-off script because a dry run is
-- rarely run once: reset, practise, reset again. It edits in place instead of
-- reseeding, so seed.sql stays the only description of the data and there is
-- no second copy to keep in step. Running it twice is the same as running it
-- once, including undoing any knockout progression from the last practice.
--
--   npm run reset:pre-event
--
-- Deliberately NOT callable by anon or authenticated. Wiping every score is
-- exactly what a stranger would want to do to this site during the event; the
-- grant below limits it to holders of the service key, who can already do
-- anything, so this adds no reach that did not already exist.
--
-- Leaves push_subscriptions and coordinators alone: notification sign-ups and
-- committee logins should survive a reset.

create or replace function reset_demo_day_to_pre_event()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nothing has kicked off, so nothing has a score. The
  -- fixtures_finished_has_scores constraint only bites on 'finished', so
  -- status and scores can be cleared together.
  --
  -- The `id is not null` is not redundant padding: Supabase preloads
  -- pg-safeupdate on the API role, which refuses an UPDATE or DELETE with no
  -- WHERE clause. A predicate that is true for every row is what "all rows,
  -- deliberately" has to look like here.
  update fixtures
  set status  = 'upcoming',
      score_a = null,
      score_b = null
  where id is not null;

  -- Knockout slots whose occupants are decided by an earlier match go back to
  -- showing a label instead of a team. The seed hardcodes winners into these
  -- rows to make the bracket look played; before the day starts they are
  -- unknown.
  --
  -- Slots NOT listed here keep their teams on purpose: the opening round of a
  -- knockout-only sport (frisbee playoff, pickleball WD final, and the
  -- badminton / table-tennis / pickleball MD openers) is a draw, not a
  -- progression, so those names are known in advance.
  update fixtures f
  set team_a_id     = null,
      team_b_id     = null,
      placeholder_a = r.ph_a,
      placeholder_b = r.ph_b
  from (
    values
      -- Football runs two groups, so its quarterfinals cross over.
      ('football',     'quarterfinal', '2026-10-24 12:30+01', 'Group A winner', 'Group B runner-up'),
      ('football',     'quarterfinal', '2026-10-24 13:15+01', 'Group B winner', 'Group A runner-up'),
      -- The rest run a single group of four, seeded 1v4 / 2v3.
      ('basketball',   'quarterfinal', '2026-10-24 12:15+01', 'Group A 1st',    'Group A 4th'),
      ('basketball',   'quarterfinal', '2026-10-24 13:00+01', 'Group A 2nd',    'Group A 3rd'),
      ('netball',      'semifinal',    '2026-10-24 13:10+01', 'Group A 1st',    'Group A 4th'),
      ('volleyball',   'semifinal',    '2026-10-24 13:05+01', 'Group A 1st',    'Group A 4th'),
      -- Fed by the opening knockout rounds rather than a group table.
      ('badminton',    'semifinal',    '2026-10-24 13:20+01', 'Winner R1',      'Winner R2'),
      ('table-tennis', 'final',        '2026-10-24 15:00+01', 'Winner SF1',     'Winner SF2')
  ) as r(sport_slug, stage, ts, ph_a, ph_b)
  where f.category_id in (
          select c.id from categories c
          join sports s on s.id = c.sport_id
          where s.slug = r.sport_slug
        )
    and f.stage = r.stage::fixture_stage
    and f.scheduled_time = r.ts::timestamptz;

  -- The seeded announcements narrate a day already in progress ("games are
  -- underway", a delay, a court change). Keep only what a committee would have
  -- posted before doors, so the first real post during the dry run is easy to
  -- spot.
  delete from announcements where id is not null;

  insert into announcements (type, title, body, published_at) values
    ('notice', 'Welcome to MGames 2026!',
     'Doors open at 08:30. Collect your wristband at reception — it gives you entry to both venues all day.',
     '2026-10-24 08:00+01');
end;
$$;

revoke all on function reset_demo_day_to_pre_event() from public;
revoke all on function reset_demo_day_to_pre_event() from anon, authenticated;
grant execute on function reset_demo_day_to_pre_event() to service_role;

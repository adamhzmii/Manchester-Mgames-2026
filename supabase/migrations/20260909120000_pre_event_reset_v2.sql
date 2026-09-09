-- MGames 2026 — pre-event reset, updated for the corrected knockout structure.
--
-- Two changes since 20260908120000:
--
-- Football and Basketball no longer have quarterfinals. Four qualifiers go
-- straight into the last four, so their first knockout round is a semifinal
-- and the round that used to sit between them and the final is now the
-- third-place playoff. Netball and Volleyball gained the second semifinal
-- their finals were already waiting on.
--
-- Table tennis and badminton are removed from the placeholder list entirely.
-- Neither has the feeder round its labels named — table tennis has no
-- semifinals behind "Winner SF1 / Winner SF2", and badminton has only one
-- opening match behind "Winner R1 / Winner R2". Both were dangling references
-- this script introduced. Their draws are known in advance, so they keep their
-- teams.

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
  -- Slots NOT listed here keep their teams on purpose: in a knockout-only
  -- sport the draw is published in advance, so the names are known before
  -- anything is played. That covers the frisbee playoff, the table-tennis and
  -- pickleball finals, and the badminton semifinal — which is deliberately
  -- excluded, because "Winner R1 / Winner R2" named a second opening round
  -- badminton does not have.
  update fixtures f
  set team_a_id     = null,
      team_b_id     = null,
      placeholder_a = r.ph_a,
      placeholder_b = r.ph_b
  from (
    values
      -- Football takes the top two from each of its two groups, so the
      -- semifinals cross over.
      ('football',   'semifinal',   '2026-10-24 12:30+01', 'Group A winner', 'Group B runner-up'),
      ('football',   'semifinal',   '2026-10-24 13:15+01', 'Group B winner', 'Group A runner-up'),
      ('football',   'third_place', '2026-10-24 14:15+01', 'Loser SF1',      'Loser SF2'),
      -- The rest run a single group of four, seeded 1v4 / 2v3.
      ('basketball', 'semifinal',   '2026-10-24 12:15+01', 'Group A 1st',    'Group A 4th'),
      ('basketball', 'semifinal',   '2026-10-24 13:00+01', 'Group A 2nd',    'Group A 3rd'),
      ('basketball', 'third_place', '2026-10-24 14:30+01', 'Loser SF1',      'Loser SF2'),
      ('netball',    'semifinal',   '2026-10-24 13:10+01', 'Group A 1st',    'Group A 4th'),
      ('netball',    'semifinal',   '2026-10-24 13:40+01', 'Group A 2nd',    'Group A 3rd'),
      ('volleyball', 'semifinal',   '2026-10-24 13:05+01', 'Group A 1st',    'Group A 4th'),
      ('volleyball', 'semifinal',   '2026-10-24 13:35+01', 'Group A 2nd',    'Group A 3rd')
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

-- ------------------------------------------------ bring the data in line ---
--
-- seed.sql describes this shape now, but it can only be applied by truncating
-- and reloading, which would throw away whatever the committee has entered.
-- These statements move the existing rows to the same place in situ, and are
-- written to be safe to re-run.

-- Football and Basketball: the first knockout round is a semifinal.
update fixtures f
set stage = 'semifinal'
from categories c, sports s
where c.id = f.category_id
  and s.id = c.sport_id
  and s.slug in ('football', 'basketball')
  and f.stage = 'quarterfinal';

-- The round that used to sit between those semifinals and the final becomes
-- the third-place playoff.
update fixtures f
set stage = 'third_place'
from categories c, sports s
where c.id = f.category_id
  and s.id = c.sport_id
  and f.stage = 'semifinal'
  and (
    (s.slug = 'football'   and f.scheduled_time = '2026-10-24 14:15+01'::timestamptz) or
    (s.slug = 'basketball' and f.scheduled_time = '2026-10-24 14:30+01'::timestamptz)
  );

-- The second semifinal each of these finals was already waiting on.
insert into fixtures (category_id, group_id, stage, team_a_id, team_b_id,
                      court_id, scheduled_time, status)
select c.id, null, 'semifinal'::fixture_stage, ta.id, tb.id, ct.id,
       n.ts::timestamptz, 'upcoming'::fixture_status
from (values
  ('netball',    'Kedah Eagles',       'Melaka Mariners', 'trinity', 'Court 3',   '2026-10-24 13:40+01'),
  ('volleyball', 'Terengganu Turtles', 'Kedah Eagles',    'trinity', 'Main Hall', '2026-10-24 13:35+01')
) as n(sport_slug, a_name, b_name, venue_slug, court_name, ts)
join sports s     on s.slug = n.sport_slug
join categories c on c.sport_id = s.id and c.slug = 'open'
join venues v     on v.slug = n.venue_slug
join courts ct    on ct.venue_id = v.id and ct.name = n.court_name
join teams ta     on ta.category_id = c.id and ta.name = n.a_name
join teams tb     on tb.category_id = c.id and tb.name = n.b_name
where not exists (
  select 1 from fixtures x
  where x.category_id = c.id
    and x.stage = 'semifinal'
    and x.scheduled_time = n.ts::timestamptz
);

-- Put back the teams on the two rows an earlier run of the reset blanked in
-- favour of labels that named rounds neither sport has. Removing them from the
-- reset's list stops it happening again, but does not undo what it already
-- wrote, so the draws have to be restored explicitly.
update fixtures f
set placeholder_a = null,
    placeholder_b = null,
    team_a_id     = ta.id,
    team_b_id     = tb.id
from categories c, sports s, teams ta, teams tb
where c.id = f.category_id
  and s.id = c.sport_id
  and s.slug = 'table-tennis'
  and f.stage = 'final'
  and ta.category_id = c.id and ta.name = 'KL Tigers'
  and tb.category_id = c.id and tb.name = 'Sarawak Hornbills'
  and f.team_a_id is null;

update fixtures f
set placeholder_a = null,
    placeholder_b = null,
    team_a_id     = ta.id,
    team_b_id     = tb.id
from categories c, sports s, teams ta, teams tb
where c.id = f.category_id
  and s.id = c.sport_id
  and s.slug = 'badminton'
  and f.stage = 'semifinal'
  and ta.category_id = c.id and ta.name = 'Johor Warriors'
  and tb.category_id = c.id and tb.name = 'KL Tigers'
  and f.team_a_id is null;

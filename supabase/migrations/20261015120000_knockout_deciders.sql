-- How a level knockout was settled, where the score itself stays level.
--
-- Football knockouts level at full time go to penalties; basketball ones to a
-- first-to-five overtime that starts again at 0–0 (rulebook). Recording
-- either as the match score would print a 1–1 as 2–1, so the shoot-out (or
-- overtime) gets its own pair of numbers: 1–1, 4–3 on penalties.
--
-- Additive for the site already deployed: it never reads these columns.

alter table fixtures
  add column if not exists decider_a smallint,
  add column if not exists decider_b smallint;

alter table fixtures
  drop constraint if exists fixtures_decider_pair;
alter table fixtures
  add constraint fixtures_decider_pair
    check (
      (decider_a is null and decider_b is null)
      or (decider_a >= 0 and decider_b >= 0)
    );

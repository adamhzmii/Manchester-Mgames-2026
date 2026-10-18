-- Forfeits, as the rulebook records them (General Rules H.6–H.11): which side
-- forfeited a finished game — 'a', 'b', or 'both' for a double forfeit.
--
-- A forfeit's official score is 0 to the side that forfeited (0–0 if no play
-- had happened), and the game is left out of score difference and score
-- totals; its result, standings points and the forfeit itself still count.
--
-- Additive for the site already deployed: it never reads the column.

alter table fixtures
  add column if not exists forfeit text;

alter table fixtures
  drop constraint if exists fixtures_forfeit_side;
alter table fixtures
  add constraint fixtures_forfeit_side
    check (forfeit is null or (forfeit in ('a', 'b', 'both') and status = 'finished'));

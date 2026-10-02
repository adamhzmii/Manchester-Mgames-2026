-- MGames 2026 — only coordinators may post, edit or delete announcements.
--
-- The first RLS migration let any authenticated user write announcements, on
-- the assumption that only coordinators would ever have an account. That
-- assumption did not hold: public sign-up is enabled on the project, so
-- anyone could create an account with the anon key every visitor's browser
-- already has, confirm an email, and then post — or quietly edit or delete —
-- the updates every phone shows under its header. Posting through the app's
-- action would also have pushed a notification to every subscriber.
--
-- The per-sport migration (20260902120000) closed this for fixtures but left
-- announcements alone. This applies the same test here: the caller must have
-- a row in `coordinators`, which no client can write to. Any coordinator may
-- post, whatever their sport — a court change is everyone's business.

drop policy if exists "coordinators insert announcements" on announcements;
drop policy if exists "coordinators update announcements" on announcements;
drop policy if exists "coordinators delete announcements" on announcements;

create policy "coordinators insert announcements"
  on announcements for insert to authenticated
  with check (is_coordinator());

create policy "coordinators update announcements"
  on announcements for update to authenticated
  using (is_coordinator())
  with check (is_coordinator());

create policy "coordinators delete announcements"
  on announcements for delete to authenticated
  using (is_coordinator());

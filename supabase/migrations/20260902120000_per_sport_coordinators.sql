-- MGames 2026 — per-sport coordinator accounts.
--
-- Replaces the original model, where any authenticated session could edit any
-- fixture. Each coordinator account is now tied to one sport and can only
-- write that sport's results. A row with a null sport_id is a committee
-- admin: no restriction, for whoever is running the day overall.
--
-- The boundary is enforced here, in RLS, not in the UI. The React tree only
-- decides whether an Edit button renders; Postgres decides whether the write
-- lands, so a forged client still gets nothing.

create table coordinators (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  -- Shown on the login screen so a coordinator can confirm which account a
  -- shared device is currently signed into.
  name       text not null,
  -- Null means "every sport" — the committee admin.
  sport_id   uuid references sports (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index coordinators_sport_idx on coordinators (sport_id);

alter table coordinators enable row level security;

-- A coordinator may read their own row, and only their own: the app needs to
-- know which sport they cover, and nobody needs the roster of who else has
-- access.
create policy "read own coordinator row"
  on coordinators for select to authenticated
  using (user_id = auth.uid());

-- Accounts are provisioned out of band (Supabase dashboard + an insert here
-- as the service role), so there is deliberately no client-facing write
-- policy on this table.

-- ------------------------------------------------------------- helpers ----

-- SECURITY DEFINER on both: the fixtures policy below has to consult
-- `coordinators`, and a plain subquery there would be subject to that table's
-- own RLS — which is a policy consulting a table whose policy consults the
-- caller, i.e. recursion. Running these as the definer sidesteps that. Both
-- are STABLE so the planner evaluates them once per statement, not per row.
-- `search_path` is pinned so the function body cannot be redirected by a
-- caller-set search_path.

create or replace function is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from coordinators where user_id = auth.uid());
$$;

create or replace function coordinator_sport_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sport_id from coordinators where user_id = auth.uid();
$$;

-- --------------------------------------------------- fixtures write RLS ----

drop policy if exists "coordinators update fixtures" on fixtures;

create policy "coordinators update fixtures in their own sport"
  on fixtures for update to authenticated
  using (
    is_coordinator()
    and (
      -- Admin: sport_id is null, so no restriction. The is_coordinator()
      -- guard above is what stops a merely-authenticated non-coordinator
      -- matching here, since their sport id would also read as null.
      coordinator_sport_id() is null
      or coordinator_sport_id() = (
        select c.sport_id from categories c where c.id = fixtures.category_id
      )
    )
  )
  with check (
    is_coordinator()
    and (
      coordinator_sport_id() is null
      or coordinator_sport_id() = (
        select c.sport_id from categories c where c.id = fixtures.category_id
      )
    )
  );

-- Announcements stay open to every coordinator: a delay or a room change is
-- worth posting whoever notices it, and the feed is append-only in practice.
-- Tighten this later if it is ever abused.

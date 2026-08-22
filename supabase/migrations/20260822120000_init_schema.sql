-- MGames 2026 — core schema
-- Derived from mgames26_system_design_spec.md (v1).
--
-- Shape of the world: Sport → Category → (Group) → Team, and Fixture as the
-- single central table every match of every sport lands in. /schedule and
-- /scores are both filtered views of `fixtures`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----

-- Stage is a fixture-level property, not a table: a sport can go straight to
-- league play (stage = 'group' throughout) or run knockouts on top of groups.
create type fixture_stage as enum (
  'group',
  'playoff',
  'quarterfinal',
  'semifinal',
  'third_place',
  'final'
);

create type fixture_status as enum ('upcoming', 'live', 'finished');

create type announcement_type as enum ('delay', 'schedule', 'notice', 'result');

-- --------------------------------------------------------------- sports ----

create table sports (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  -- Two-letter badge shown on fixture cards and map pins.
  code        text not null,
  -- Per-sport accent, stored with the sport so the palette lives in one place
  -- rather than being hardcoded per screen.
  color       text not null default '#3C2A6E',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- A sport splits into categories (Pickleball: Men's Doubles + Women's
-- Doubles; Table Tennis: a single Open). Every sport has at least one, so
-- nothing downstream needs a "does this sport have categories?" branch.
create table categories (
  id          uuid primary key default gen_random_uuid(),
  sport_id    uuid not null references sports (id) on delete cascade,
  slug        text not null,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (sport_id, slug)
);

-- Groups are created once registration closes — sizes depend on final entry
-- numbers (Pickleball, Table Tennis especially). Sports running a flat league
-- simply have no group rows, and fixtures carry a null group_id.
create table groups (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (category_id, name)
);

create table teams (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  group_id    uuid references groups (id) on delete set null,
  name        text not null,
  university  text,
  created_at  timestamptz not null default now(),
  unique (category_id, name)
);

-- --------------------------------------------------------------- venues ----

create table venues (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  -- "Trinity" / "Sugden" — the form that fits on a fixture card.
  short_name  text not null,
  address     text,
  latitude    numeric(9, 6),
  longitude   numeric(9, 6),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- A court is a physical place (court / pitch / table / hall), distinct from
-- the fixture happening on it. sport_id is optional: some spaces are shared.
create table courts (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues (id) on delete cascade,
  sport_id    uuid references sports (id) on delete set null,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (venue_id, name)
);

-- ------------------------------------------------------------- fixtures ----

create table fixtures (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references categories (id) on delete cascade,
  -- Null once a fixture leaves the group stage.
  group_id       uuid references groups (id) on delete set null,
  stage          fixture_stage not null default 'group',
  -- Nullable so a knockout slot can exist before its feeder match finishes
  -- ("Winner QF1"); placeholder_a/b carry the label to show until then.
  team_a_id      uuid references teams (id) on delete set null,
  team_b_id      uuid references teams (id) on delete set null,
  placeholder_a  text,
  placeholder_b  text,
  court_id       uuid references courts (id) on delete set null,
  scheduled_time timestamptz not null,
  status         fixture_status not null default 'upcoming',
  score_a        integer,
  score_b        integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint fixtures_distinct_teams
    check (team_a_id is null or team_b_id is null or team_a_id <> team_b_id),
  constraint fixtures_scores_non_negative
    check ((score_a is null or score_a >= 0) and (score_b is null or score_b >= 0)),
  -- A finished fixture must carry both scores; nothing else may be half-scored.
  constraint fixtures_finished_has_scores
    check (status <> 'finished' or (score_a is not null and score_b is not null))
);

create index fixtures_scheduled_time_idx on fixtures (scheduled_time);
create index fixtures_status_idx on fixtures (status);
create index fixtures_category_idx on fixtures (category_id);
create index fixtures_group_idx on fixtures (group_id) where group_id is not null;
create index fixtures_court_idx on fixtures (court_id);

-- ---------------------------------------------------------------- food -----

create table vendors (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues (id) on delete cascade,
  name        text not null,
  cuisine     text not null,
  -- Human-readable pitch, e.g. "Foyer · Stall 1".
  location    text,
  photo_url   text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table menu_items (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references vendors (id) on delete cascade,
  name        text not null,
  -- Integer pence: no float rounding on a price list.
  price_pence integer not null check (price_pence >= 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index menu_items_vendor_idx on menu_items (vendor_id);

-- ------------------------------------------------------- announcements -----

create table announcements (
  id          uuid primary key default gen_random_uuid(),
  type        announcement_type not null default 'notice',
  title       text not null,
  body        text,
  published_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index announcements_published_at_idx on announcements (published_at desc);

-- ------------------------------------------------------------ triggers -----

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fixtures_set_updated_at
  before update on fixtures
  for each row
  execute function set_updated_at();

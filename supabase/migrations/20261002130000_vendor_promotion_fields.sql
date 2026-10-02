-- MGames 2026 — what a stall needs to sell itself.
--
-- Vendors are part of what makes the day, and helping them sell out is part
-- of the committee's job. A name and a menu do not advertise anything, so
-- three optional fields the committee fills in from the dashboard:
--
--   tagline    one line that makes someone walk over
--   instagram  the stall's handle, so the page sends people to it
--   tags       short labels shown as chips: "Halal", "Vegetarian options"
--
-- All additive and empty by default; nothing reads them until the Food page
-- that shows them, and a stall with none of them set looks as it did before.

alter table vendors
  add column if not exists tagline text,
  add column if not exists instagram text,
  add column if not exists tags text[] not null default '{}';

comment on column vendors.tagline is 'One line that sells the stall, shown under its name.';
comment on column vendors.instagram is 'Instagram handle, with or without the @.';
comment on column vendors.tags is 'Short labels shown as chips, e.g. Halal, Vegetarian options.';

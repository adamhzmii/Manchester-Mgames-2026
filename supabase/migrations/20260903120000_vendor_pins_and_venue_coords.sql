-- MGames 2026 — food-stall pins, and venue coordinates that are actually right.
--
-- Two changes, both in service of the map page:
--
-- 1. Vendors get coordinates so individual food stalls can be pinned inside a
--    venue, not just listed. Nullable, because the committee will not know
--    exactly where each stall sits until the day — a vendor without
--    coordinates simply does not get a pin.
--
-- 2. The venue positions seeded at the start were approximations and both were
--    wrong: Trinity by roughly 600m and Sugden by roughly 200m, enough to send
--    somebody to the wrong end of campus. These are geocoded from the
--    addresses the committee supplied.

alter table vendors
  add column latitude  numeric(9, 6),
  add column longitude numeric(9, 6);

comment on column vendors.latitude is
  'Optional stall position for the venue map. Null means the stall is listed but not pinned.';

-- Sugden Sports Centre, 114 Grosvenor St, Manchester M1 7HL.
update venues
set latitude  = 53.471186,
    longitude = -2.235999,
    address   = '114 Grosvenor St, Manchester M1 7HL'
where slug = 'sugden';

-- Trinity Sports Centre, Cambridge St, Hulme, Manchester M15 6HP.
update venues
set latitude  = 53.464754,
    longitude = -2.239163,
    address   = 'Cambridge St, Hulme, Manchester M15 6HP'
where slug = 'trinity';

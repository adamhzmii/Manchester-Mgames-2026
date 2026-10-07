-- Football moves to Denmark Road Sports Centre this year.
--
-- 120 Denmark Road, Manchester M15 6FG: the student quarter, off Oxford Road
-- by the Whitworth. Coordinates from OpenStreetMap. Football only, and no
-- food stalls there — those stay at Trinity and Sugden.

insert into venues (slug, name, short_name, address, latitude, longitude, sort_order)
values (
  'denmark-road',
  'Denmark Road Sports Centre',
  'Denmark Road',
  '120 Denmark Road, Manchester M15 6FG',
  53.460865,
  -2.234874,
  3
)
on conflict (slug) do nothing;

-- One pitch to start with: the football schedule used a single court. Add
-- "Pitch 2" and so on, or rename this one, once the committee knows which
-- pitches it has booked.
insert into courts (venue_id, sport_id, name, sort_order)
select v.id, s.id, 'Pitch 1', 1
from venues v, sports s
where v.slug = 'denmark-road' and s.slug = 'football'
on conflict (venue_id, name) do nothing;

-- Every football game moves there.
update fixtures f
set court_id = (
  select c.id
  from courts c
  join venues v on v.id = c.venue_id
  where v.slug = 'denmark-road' and c.name = 'Pitch 1'
)
from categories cat
join sports s on s.id = cat.sport_id
where f.category_id = cat.id
  and s.slug = 'football';

-- The football court left behind at Sugden has nothing scheduled on it now,
-- and would only offer itself when someone moves a game.
delete from courts c
using venues v, sports s
where c.venue_id = v.id
  and c.sport_id = s.id
  and v.slug = 'sugden'
  and s.slug = 'football'
  and not exists (select 1 from fixtures f where f.court_id = c.id);

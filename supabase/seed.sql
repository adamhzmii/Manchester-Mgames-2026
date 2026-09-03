-- MGames 2026 — development seed.
--
-- Mirrors the Claude Design prototype so /schedule, /scores and /food render
-- against realistic data before real registrations land. Runs as the service
-- role (RLS bypassed). Safe to re-run: it truncates first.
--
-- Event day is Saturday 24 October 2026, which is still BST (clocks go back
-- on the 25th), so every kick-off below is written with an explicit +01.

truncate table
  menu_items, vendors, announcements, fixtures, teams, groups,
  categories, courts, sports, venues
restart identity cascade;

-- --------------------------------------------------------------- sports ----

insert into sports (slug, name, code, color, sort_order) values
  ('football',     'Football',     'FB', '#3C2A6E', 1),
  ('basketball',   'Basketball',   'BB', '#C77D18', 2),
  ('netball',      'Netball',      'NB', '#B23A8E', 3),
  ('volleyball',   'Volleyball',   'VB', '#2E7D6B', 4),
  ('frisbee',      'Frisbee',      'FR', '#4A6FA5', 5),
  ('badminton',    'Badminton',    'BD', '#7A4FBF', 6),
  ('table-tennis', 'Table Tennis', 'TT', '#C0392B', 7),
  ('pickleball',   'Pickleball',   'PB', '#568C2E', 8);

-- Most sports run one open category; Pickleball splits by gender. Keeping the
-- single-category sports in the same table means no screen needs a special
-- case for "sports that don't have categories".
insert into categories (sport_id, slug, name, sort_order)
select s.id, v.slug, v.name, v.sort_order
from (values
  ('football',     'open',           'Open',            1),
  ('basketball',   'open',           'Open',            1),
  ('netball',      'open',           'Open',            1),
  ('volleyball',   'open',           'Open',            1),
  ('frisbee',      'open',           'Mixed',           1),
  ('badminton',    'open',           'Open',            1),
  ('table-tennis', 'open',           'Open',            1),
  ('pickleball',   'mens-doubles',   'Men''s Doubles',  1),
  ('pickleball',   'womens-doubles', 'Women''s Doubles', 2)
) as v(sport_slug, slug, name, sort_order)
join sports s on s.slug = v.sport_slug;

-- --------------------------------------------------------------- venues ----

insert into venues (slug, name, short_name, address, latitude, longitude, sort_order) values
  ('trinity', 'Trinity Sports Centre', 'Trinity',
   'Cambridge St, Hulme, Manchester M15 6HP', 53.464754, -2.239163, 1),
  ('sugden',  'Sugden Sports Centre',  'Sugden',
   '114 Grosvenor St, Manchester M1 7HL',     53.471186, -2.235999, 2);

insert into courts (venue_id, sport_id, name, sort_order)
select v.id, s.id, c.name, c.sort_order
from (values
  ('trinity', 'basketball',   'Court 2',   1),
  ('trinity', 'netball',      'Court 3',   2),
  ('trinity', null,           'Main Hall', 3),
  ('sugden',  'football',     'Court 1',   1),
  ('sugden',  'badminton',    'Court A',   2),
  ('sugden',  'badminton',    'Court B',   3),
  ('sugden',  'pickleball',   'Court C',   4),
  ('sugden',  'table-tennis', 'TT Room',   5)
) as c(venue_slug, sport_slug, name, sort_order)
join venues v on v.slug = c.venue_slug
left join sports s on s.slug = c.sport_slug;

-- --------------------------------------------------------------- groups ----

insert into groups (category_id, name, sort_order)
select c.id, g.name, g.sort_order
from (values
  ('football',   'open', 'Group A', 1),
  ('football',   'open', 'Group B', 2),
  ('basketball', 'open', 'Group A', 1),
  ('netball',    'open', 'Group A', 1),
  ('volleyball', 'open', 'Group A', 1)
) as g(sport_slug, cat_slug, name, sort_order)
join sports s on s.slug = g.sport_slug
join categories c on c.sport_id = s.id and c.slug = g.cat_slug;

-- ---------------------------------------------------------------- teams ----

-- One row per team per category: the same university fields two different
-- squads for Football and Netball, and they are separate rows by design.
insert into teams (category_id, group_id, name, university)
select c.id, g.id, t.name, t.university
from (values
  ('football', 'open', 'Group A', 'KL Tigers',           'University of Manchester'),
  ('football', 'open', 'Group A', 'Melaka Mariners',     'Manchester Metropolitan University'),
  ('football', 'open', 'Group A', 'Kedah Eagles',        'University of Salford'),
  ('football', 'open', 'Group A', 'Perak Bison',         'University of Bolton'),
  ('football', 'open', 'Group B', 'Penang Panthers',     'University of Manchester'),
  ('football', 'open', 'Group B', 'Sabah Rhinos',        'Manchester Metropolitan University'),
  ('football', 'open', 'Group B', 'Johor Warriors',      'University of Salford'),
  ('football', 'open', 'Group B', 'Terengganu Turtles',  'University of Central Lancashire'),

  ('basketball', 'open', 'Group A', 'Penang Panthers',   'University of Manchester'),
  ('basketball', 'open', 'Group A', 'Sabah Rhinos',      'Manchester Metropolitan University'),
  ('basketball', 'open', 'Group A', 'Selangor Smashers', 'University of Salford'),
  ('basketball', 'open', 'Group A', 'Sarawak Hornbills', 'University of Bolton'),

  ('netball', 'open', 'Group A', 'Selangor Smashers',    'University of Salford'),
  ('netball', 'open', 'Group A', 'Sarawak Hornbills',    'University of Bolton'),
  ('netball', 'open', 'Group A', 'Kedah Eagles',         'University of Manchester'),
  ('netball', 'open', 'Group A', 'Melaka Mariners',      'Manchester Metropolitan University'),

  ('volleyball', 'open', 'Group A', 'Sarawak Hornbills', 'University of Bolton'),
  ('volleyball', 'open', 'Group A', 'Melaka Mariners',   'Manchester Metropolitan University'),
  ('volleyball', 'open', 'Group A', 'Terengganu Turtles','University of Central Lancashire'),
  ('volleyball', 'open', 'Group A', 'Kedah Eagles',      'University of Manchester')
) as t(sport_slug, cat_slug, group_name, name, university)
join sports s on s.slug = t.sport_slug
join categories c on c.sport_id = s.id and c.slug = t.cat_slug
join groups g on g.category_id = c.id and g.name = t.group_name;

-- Knockout-only sports carry no groups, so their teams have a null group_id.
insert into teams (category_id, group_id, name, university)
select c.id, null, t.name, t.university
from (values
  ('badminton',    'open',           'Johor Warriors',          'University of Salford'),
  ('badminton',    'open',           'Perak Bison',             'University of Bolton'),
  ('badminton',    'open',           'KL Tigers',               'University of Manchester'),
  ('table-tennis', 'open',           'KL Tigers',               'University of Manchester'),
  ('table-tennis', 'open',           'Johor Warriors',          'University of Salford'),
  ('table-tennis', 'open',           'Sarawak Hornbills',       'University of Bolton'),
  ('frisbee',      'open',           'Sabah Rhinos',            'Manchester Metropolitan University'),
  ('frisbee',      'open',           'Perak Bison',             'University of Bolton'),
  ('pickleball',   'mens-doubles',   'KL Tigers (MD)',          'University of Manchester'),
  ('pickleball',   'mens-doubles',   'Selangor Smashers (MD)',  'University of Salford'),
  ('pickleball',   'womens-doubles', 'Penang Panthers (WD)',    'University of Manchester'),
  ('pickleball',   'womens-doubles', 'Johor Warriors (WD)',     'University of Salford')
) as t(sport_slug, cat_slug, name, university)
join sports s on s.slug = t.sport_slug
join categories c on c.sport_id = s.id and c.slug = t.cat_slug;

-- ------------------------------------------------------------- fixtures ----

-- Group games get their group_id from team A (both sides share it). Knockout
-- rows whose feeder match has not finished carry placeholder labels instead of
-- team ids — that is what "Winner QF1" on the bracket is.
with f(sport_slug, cat_slug, stage, a_name, b_name, ph_a, ph_b,
       venue_slug, court_name, ts, status, sa, sb) as (
  values
  -- Football Group A (complete round robin)
  ('football','open','group','KL Tigers','Melaka Mariners',null::text,null::text,'sugden','Court 1','2026-10-24 09:30+01','finished',3,1),
  ('football','open','group','Kedah Eagles','Perak Bison',null,null,'sugden','Court 1','2026-10-24 10:00+01','finished',2,1),
  ('football','open','group','KL Tigers','Kedah Eagles',null,null,'sugden','Court 1','2026-10-24 10:30+01','finished',2,0),
  ('football','open','group','Melaka Mariners','Perak Bison',null,null,'sugden','Court 1','2026-10-24 11:00+01','finished',1,1),
  ('football','open','group','KL Tigers','Perak Bison',null,null,'sugden','Court 1','2026-10-24 11:15+01','finished',1,0),
  ('football','open','group','Melaka Mariners','Kedah Eagles',null,null,'sugden','Court 1','2026-10-24 11:45+01','finished',2,0),
  -- Football Group B (complete round robin)
  ('football','open','group','Penang Panthers','Sabah Rhinos',null,null,'sugden','Court 1','2026-10-24 11:30+01','finished',2,2),
  ('football','open','group','Johor Warriors','Terengganu Turtles',null,null,'sugden','Court 1','2026-10-24 09:45+01','finished',3,1),
  ('football','open','group','Penang Panthers','Johor Warriors',null,null,'sugden','Court 1','2026-10-24 10:15+01','finished',3,0),
  ('football','open','group','Sabah Rhinos','Terengganu Turtles',null,null,'sugden','Court 1','2026-10-24 10:45+01','finished',2,0),
  ('football','open','group','Penang Panthers','Terengganu Turtles',null,null,'sugden','Court 1','2026-10-24 11:55+01','finished',2,1),
  ('football','open','group','Sabah Rhinos','Johor Warriors',null,null,'sugden','Court 1','2026-10-24 12:10+01','finished',2,1),
  -- Basketball Group A
  ('basketball','open','group','Penang Panthers','Sabah Rhinos',null,null,'trinity','Court 2','2026-10-24 10:00+01','finished',42,38),
  ('basketball','open','group','Penang Panthers','Selangor Smashers',null,null,'trinity','Court 2','2026-10-24 10:40+01','finished',50,44),
  ('basketball','open','group','Penang Panthers','Sarawak Hornbills',null,null,'trinity','Court 2','2026-10-24 11:20+01','finished',58,41),
  ('basketball','open','group','Sabah Rhinos','Selangor Smashers',null,null,'trinity','Court 2','2026-10-24 09:20+01','finished',48,40),
  ('basketball','open','group','Sabah Rhinos','Sarawak Hornbills',null,null,'trinity','Court 2','2026-10-24 11:50+01','finished',52,45),
  ('basketball','open','group','Selangor Smashers','Sarawak Hornbills',null,null,'trinity','Court 2','2026-10-24 09:50+01','finished',40,35),
  -- Netball Group A
  ('netball','open','group','Selangor Smashers','Kedah Eagles',null,null,'trinity','Court 3','2026-10-24 10:30+01','finished',24,19),
  ('netball','open','group','Selangor Smashers','Sarawak Hornbills',null,null,'trinity','Court 3','2026-10-24 11:10+01','finished',30,22),
  ('netball','open','group','Selangor Smashers','Melaka Mariners',null,null,'trinity','Court 3','2026-10-24 09:30+01','finished',28,15),
  ('netball','open','group','Sarawak Hornbills','Kedah Eagles',null,null,'trinity','Court 3','2026-10-24 11:50+01','finished',26,20),
  ('netball','open','group','Sarawak Hornbills','Melaka Mariners',null,null,'trinity','Court 3','2026-10-24 10:00+01','finished',31,18),
  ('netball','open','group','Kedah Eagles','Melaka Mariners',null,null,'trinity','Court 3','2026-10-24 12:20+01','finished',22,20),
  -- Volleyball Group A
  ('volleyball','open','group','Sarawak Hornbills','Terengganu Turtles',null,null,'trinity','Main Hall','2026-10-24 11:00+01','finished',2,1),
  ('volleyball','open','group','Sarawak Hornbills','Melaka Mariners',null,null,'trinity','Main Hall','2026-10-24 09:40+01','finished',2,0),
  ('volleyball','open','group','Sarawak Hornbills','Kedah Eagles',null,null,'trinity','Main Hall','2026-10-24 12:00+01','finished',2,0),
  ('volleyball','open','group','Melaka Mariners','Terengganu Turtles',null,null,'trinity','Main Hall','2026-10-24 10:20+01','finished',2,1),
  ('volleyball','open','group','Melaka Mariners','Kedah Eagles',null,null,'trinity','Main Hall','2026-10-24 12:30+01','finished',2,0),
  ('volleyball','open','group','Terengganu Turtles','Kedah Eagles',null,null,'trinity','Main Hall','2026-10-24 09:00+01','finished',2,1),
  -- Other sports, group/opening rounds
  ('badminton','open','group','Johor Warriors','Perak Bison',null,null,'sugden','Court B','2026-10-24 10:00+01','finished',2,0),
  ('table-tennis','open','group','KL Tigers','Johor Warriors',null,null,'sugden','TT Room','2026-10-24 11:15+01','finished',3,2),
  ('pickleball','mens-doubles','group','KL Tigers (MD)','Selangor Smashers (MD)',null,null,'sugden','Court C','2026-10-24 11:45+01','finished',11,7),
  -- Knockouts already played
  ('football','open','quarterfinal','Sabah Rhinos','Melaka Mariners',null,null,'sugden','Court 1','2026-10-24 12:30+01','finished',2,1),
  ('basketball','open','quarterfinal','Penang Panthers','Sarawak Hornbills',null,null,'trinity','Court 2','2026-10-24 12:15+01','finished',55,40),
  -- Live right now
  ('football','open','quarterfinal','KL Tigers','Penang Panthers',null,null,'sugden','Court 1','2026-10-24 13:15+01','live',1,0),
  ('basketball','open','quarterfinal','Sabah Rhinos','Selangor Smashers',null,null,'trinity','Court 2','2026-10-24 13:00+01','live',28,26),
  ('netball','open','semifinal','Selangor Smashers','Sarawak Hornbills',null,null,'trinity','Court 3','2026-10-24 13:10+01','live',15,15),
  ('badminton','open','semifinal','Johor Warriors','KL Tigers',null,null,'sugden','Court B','2026-10-24 13:20+01','live',1,1),
  ('volleyball','open','semifinal','Sarawak Hornbills','Melaka Mariners',null,null,'trinity','Main Hall','2026-10-24 13:05+01','live',1,0),
  -- Still to come
  ('frisbee','open','playoff','Sabah Rhinos','Perak Bison',null,null,'trinity','Main Hall','2026-10-24 14:00+01','upcoming',null,null),
  ('football','open','semifinal',null,null,'Winner QF1','Winner QF2','sugden','Court 1','2026-10-24 14:15+01','upcoming',null,null),
  ('basketball','open','semifinal',null,null,'Winner QF1','Winner QF2','trinity','Court 2','2026-10-24 14:30+01','upcoming',null,null),
  ('table-tennis','open','final','KL Tigers','Sarawak Hornbills',null,null,'sugden','TT Room','2026-10-24 15:00+01','upcoming',null,null),
  ('pickleball','womens-doubles','final','Penang Panthers (WD)','Johor Warriors (WD)',null,null,'sugden','Court C','2026-10-24 15:15+01','upcoming',null,null),
  ('netball','open','final',null,null,'Winner SF1','Winner SF2','trinity','Court 3','2026-10-24 15:30+01','upcoming',null,null),
  ('volleyball','open','final',null,null,'Winner SF1','Winner SF2','trinity','Main Hall','2026-10-24 15:45+01','upcoming',null,null),
  ('basketball','open','final',null,null,'Winner SF1','Winner SF2','trinity','Court 2','2026-10-24 15:45+01','upcoming',null,null),
  ('football','open','final',null,null,'Winner SF1','Winner SF2','sugden','Court 1','2026-10-24 16:00+01','upcoming',null,null)
)
insert into fixtures (category_id, group_id, stage, team_a_id, team_b_id,
                      placeholder_a, placeholder_b, court_id, scheduled_time,
                      status, score_a, score_b)
select c.id,
       case when f.stage = 'group' then ta.group_id end,
       f.stage::fixture_stage,
       ta.id, tb.id, f.ph_a, f.ph_b, ct.id,
       f.ts::timestamptz, f.status::fixture_status, f.sa, f.sb
from f
join sports s      on s.slug = f.sport_slug
join categories c  on c.sport_id = s.id and c.slug = f.cat_slug
join venues v      on v.slug = f.venue_slug
join courts ct     on ct.venue_id = v.id and ct.name = f.court_name
left join teams ta on ta.category_id = c.id and ta.name = f.a_name
left join teams tb on tb.category_id = c.id and tb.name = f.b_name;

-- ----------------------------------------------------------------- food ----

insert into vendors (venue_id, name, cuisine, location, sort_order)
select v.id, d.name, d.cuisine, d.location, d.sort_order
from (values
  ('sugden',  'Nasi Lemak Corner',  'Malaysian',   'Foyer · Stall 1',      1),
  ('trinity', 'Satay Station',      'BBQ / Grill', 'Courtyard · Stall A',  2),
  ('trinity', 'Roti King Express',  'Mamak',       'Courtyard · Stall B',  3),
  ('sugden',  'Wok This Way',       'Chinese',     'Foyer · Stall 2',      4),
  ('trinity', 'Boba Lab',           'Bubble Tea',  'Main Hall · Stall C',  5),
  ('sugden',  'Sweet Kuih Co.',     'Desserts',    'Foyer · Stall 3',      6)
) as d(venue_slug, name, cuisine, location, sort_order)
join venues v on v.slug = d.venue_slug;

insert into menu_items (vendor_id, name, price_pence, sort_order)
select ve.id, m.name, m.price_pence, m.sort_order
from (values
  ('Nasi Lemak Corner', 'Nasi Lemak Ayam',    650, 1),
  ('Nasi Lemak Corner', 'Beef Rendang Rice',  750, 2),
  ('Nasi Lemak Corner', 'Curry Puff (2)',     300, 3),
  ('Nasi Lemak Corner', 'Teh Tarik',          250, 4),
  ('Satay Station',     'Chicken Satay (6)',  500, 1),
  ('Satay Station',     'Beef Satay (6)',     600, 2),
  ('Satay Station',     'Lontong',            400, 3),
  ('Satay Station',     'Bandung',            250, 4),
  ('Roti King Express', 'Roti Canai',         400, 1),
  ('Roti King Express', 'Murtabak Ayam',      650, 2),
  ('Roti King Express', 'Maggi Goreng',       550, 3),
  ('Roti King Express', 'Milo Ais',           250, 4),
  ('Wok This Way',      'Char Kuey Teow',     700, 1),
  ('Wok This Way',      'Hokkien Mee',        700, 2),
  ('Wok This Way',      'Spring Rolls (3)',   350, 3),
  ('Wok This Way',      'Iced Lemon Tea',     200, 4),
  ('Boba Lab',          'Classic Milk Tea',   450, 1),
  ('Boba Lab',          'Brown Sugar Boba',   500, 2),
  ('Boba Lab',          'Matcha Latte',       500, 3),
  ('Boba Lab',          'Passionfruit Green', 450, 4),
  ('Sweet Kuih Co.',    'Kuih Platter',       400, 1),
  ('Sweet Kuih Co.',    'Cendol',             450, 2),
  ('Sweet Kuih Co.',    'Onde-Onde (5)',      300, 3),
  ('Sweet Kuih Co.',    'Ais Kacang',         450, 4)
) as m(vendor_name, name, price_pence, sort_order)
join vendors ve on ve.name = m.vendor_name;

-- -------------------------------------------------------- announcements ----

insert into announcements (type, title, body, published_at) values
  ('delay',    'Basketball QF on Court 2 pushed back 15 min',
   'Sabah vs Selangor now tipping off at 13:30 due to an earlier over-run. Trinity Court 2.',
   '2026-10-24 13:15+01'),
  ('schedule', 'Pickleball Women''s Doubles final moved to Court C',
   'To keep things running smoothly the WD final is now on Sugden Court C at 15:15.',
   '2026-10-24 12:50+01'),
  ('notice',   'Free water refill stations open',
   'Refill points are now live at both venue receptions and the Trinity main hall. Stay hydrated!',
   '2026-10-24 12:30+01'),
  ('notice',   'Lost & found is at the info desk',
   'Handed something in or lost a kit bag? Check the info desk at each venue reception.',
   '2026-10-24 11:40+01'),
  ('notice',   'Opening ceremony done — games are underway',
   'Thanks to everyone who joined the opening. Group stages are now in full swing across both venues.',
   '2026-10-24 10:15+01'),
  ('notice',   'Welcome to MGames 2026!',
   'Doors are open. Collect your wristband at reception — it gives you entry to both venues all day.',
   '2026-10-24 09:00+01');

-- Final stall placement, with each stall's spot (S1–S8 at Sugden, T1–T4 at
-- Trinity), listed in that order; Pasar Pagi's line and cheesecake price.

update vendors set
  venue_id = (select id from venues where slug = x.venue),
  location = x.spot,
  sort_order = x.sort_order
from (values
  ('Pasar Pagi', 'sugden', 'S1', 1),
  ('Selera Pantai Timur', 'sugden', 'S2', 2),
  ('Penghulu Cantik Corner', 'sugden', 'S3', 3),
  ('The Chilli Tales', 'sugden', 'S4', 4),
  ('Kedai Kita', 'sugden', 'S5', 5),
  ('matcham yes', 'sugden', 'S6', 6),
  ('MCR MNight', 'sugden', 'S7', 7),
  ('Warung MCOT', 'sugden', 'S8', 8),
  ('Tiny Tempeh Liverpool', 'trinity', 'T1', 9),
  ('Makan Nyaman', 'trinity', 'T2', 10),
  ('Nora', 'trinity', 'T3', 11),
  ('Popis By Mika', 'trinity', 'T4', 12)
) as x(name, venue, spot, sort_order)
where vendors.name = x.name;

update vendors set cuisine = 'Kolo mee · pisang goreng' where name = 'Pasar Pagi';

update menu_items set price_pence = 250
where name = 'Basque burnt cheesecake cupcake'
  and vendor_id = (select id from vendors where name = 'Pasar Pagi');

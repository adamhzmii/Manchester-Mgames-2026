-- Kia Kitchen has withdrawn; MNight trades as MCR MNight; every stall's
-- Instagram, and the order the committee lists them in (Sugden, then Trinity).

delete from vendors where name = 'Kia Kitchen';

update vendors set name = 'MCR MNight' where name = 'MNight';

update vendors set instagram = x.handle, sort_order = x.sort_order
from (values
  ('Warung MCOT', null, 1),
  ('Selera Pantai Timur', null, 2),
  ('Makan Nyaman', 'naziahkhan81_', 3),
  ('Penghulu Cantik Corner', null, 4),
  ('The Chilli Tales', 'thechillitales', 5),
  ('MCR MNight', 'mcr.mnight', 6),
  ('matcham yes', 'matchamyes', 7),
  ('Tiny Tempeh Liverpool', 'tinytempeh_mazmalaysianfood', 8),
  ('Kedai Kita', 'kedaikitamcr', 9),
  ('Nora', null, 10),
  ('Popis By Mika', 'popisbymika', 11),
  ('Pasar Pagi', 'pasarpagi.mcr', 12)
) as x(name, handle, sort_order)
where vendors.name = x.name;

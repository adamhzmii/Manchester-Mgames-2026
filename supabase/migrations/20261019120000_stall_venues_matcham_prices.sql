-- Where each stall stands, now the committee has placed them, and matcham
-- yes's menu with its prices. With venues set, the Food page's Sugden /
-- Trinity filter and each venue's "Food at …" list appear on their own.

update vendors set venue_id = (select id from venues where slug = 'sugden')
where name in (
  'Kia Kitchen', 'Selera Pantai Timur', 'Makan Nyaman', 'Penghulu Cantik Corner',
  'MNight', 'Warung MCOT', 'The Chilli Tales'
);

update vendors set venue_id = (select id from venues where slug = 'trinity')
where name in (
  'matcham yes', 'Tiny Tempeh Liverpool', 'Kedai Kita', 'Nora', 'Popis By Mika', 'Pasar Pagi'
);

update vendors
set tagline = 'Your unordinary dessert place',
    tags = array['Oat milk +50p']::text[]
where name = 'matcham yes';

delete from menu_items where vendor_id in (select id from vendors where name = 'matcham yes');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Malaysian breakfast favourite', 850, 'Fragrant blue rice with rendang chicken. £12 with a cold matcha or hojicha latte.', 1),
    ('Matcha cheesecake', 500, 'A luxuriously creamy twist on the ordinary New York cheesecake, with a slight umami taste from Niko Neko Yuri.', 2),
    ('Hojicha cheesecake', 500, 'A rich and creamy New York cheesecake infused with roasted tea flavour from Niko Neko Akane.', 3),
    ('Matcha brownies', 350, 'Deliciously fudgy brownies infused with Niko Neko matcha powder. 2 for £6.', 4),
    ('Hojicha brownies', 350, 'Deliciously fudgy brownies infused with Niko Neko hojicha powder. 2 for £6.', 5),
    ('Matcha latte (hot / cold)', 400, 'Hot £4, cold £4.50. A smooth and creamy blend of Niko Neko Yuri with milk.', 6),
    ('Hojicha latte (hot / cold)', 400, 'Hot £4, cold £4.50. A warm, comforting latte made with Niko Neko Akane.', 7),
    ('Dirty matcha (hot / cold)', 500, 'Hot £5, cold £5.50. A fun and flavourful blend of Yuri and a shot of coffee roasted by Cartwheel Coffee.', 8),
    ('Coffee latte', 350, 'Coffee beans ground by Cartwheel Coffee.', 9)
) as x(name, price_pence, description, sort_order)
where v.name = 'matcham yes';

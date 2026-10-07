-- The committee's real food stalls, replacing the mock ones.
--
-- Where each stall will stand is not decided yet, so a stall's venue is now
-- optional: the site shows "location to be confirmed" until it is set.
-- Several menus come without prices, so a price is optional too, and an item
-- can carry a line of description (matcham yes describes every drink).

alter table vendors alter column venue_id drop not null;
alter table menu_items alter column price_pence drop not null;
alter table menu_items add column if not exists description text;

-- The mock stalls, and their menus with them (on delete cascade). The
-- predicate is pg-safeupdate's price for a whole-table delete.
delete from vendors where id is not null;

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Kia Kitchen', 'Malaysian · kuih', '{}'::text[], 1)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Nasi ayam geprek', 800, null, 1),
    ('Nasi beef rendang', 900, null, 2),
    ('Ice cendol', 450, null, 3),
    ('Kuih talam pandan', 100, null, 4),
    ('Kuih seri muka', 100, null, 5),
    ('Kuih sarang semut (honeycomb cake)', 100, null, 6),
    ('Onde-onde pandan', 100, null, 7),
    ('Kuih lapis', 100, null, 8),
    ('Kuih tako', 100, null, 9)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('matcham yes', 'Matcha café · cheesecakes', '{}'::text[], 2)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Fried mee hoon with rendang chicken', null, null, 1),
    ('Matcha cheesecake', null, 'A luxuriously creamy twist on the ordinary New York cheesecake, with a slight umami taste from Niko Neko Yuri.', 2),
    ('Hojicha cheesecake', null, 'A rich and creamy New York cheesecake infused with roasted tea flavour from Niko Neko Akane.', 3),
    ('Original New York cheesecake', null, 'Your all-time favourite New York cheesecake, with a secret twist.', 4),
    ('Matcha brownies', null, 'Deliciously fudgy brownies infused with Matchdo premium matcha powder.', 5),
    ('Hojicha brownies', null, 'Deliciously fudgy brownies infused with Matchdo premium matcha powder.', 6),
    ('Matcha latte (hot / cold)', null, 'A smooth and creamy blend of Niko Neko Yuri with milk.', 7),
    ('Hojicha latte (hot / cold)', null, 'A warm, comforting latte made with Niko Neko Akane.', 8),
    ('Dirty matcha (hot / cold)', null, 'A fun and flavourful blend of Yuri and a shot of coffee roasted by Cartwheel Coffee.', 9),
    ('Oolong yuzu matcha cloud', null, 'Brewed yuzu in oolong tea, with a touch of matcha cream.', 10),
    ('Coffee latte', null, 'Coffee beans ground by Cartwheel Coffee.', 11)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Tiny Tempeh Liverpool', 'Malaysian', array['Vegetarian options']::text[], 3)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Nasi lemak ayam rempah', 950, null, 1),
    ('Nasi lemak egg (V)', 750, null, 2),
    ('Nasi tomato ayam masak merah', 1000, null, 3),
    ('Bee hoon goreng + fried egg', 750, null, 4),
    ('Mee goreng + fried egg', 800, null, 5),
    ('Karipap ayam kentang', 120, null, 6),
    ('Karipap sardines kentang', 120, null, 7),
    ('Karipap kentang (V)', null, null, 8)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Selera Pantai Timur', 'East Coast Malaysian', '{}'::text[], 4)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Nasi kerabu', null, null, 1),
    ('Nasi Kak Wok', null, null, 2)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Kedia Kita', 'Nasi kerabu', '{}'::text[], 5)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Nasi kerabu ayam', 1100, null, 1),
    ('Nasi kerabu daging', 1200, null, 2)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Chili Tales', 'Malaysian rice dishes', '{}'::text[], 6)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Nasi lemak (regular)', 500, 'With condiments.', 1),
    ('Nasi lemak + chicken goreng rempah', 850, 'With condiments.', 2),
    ('Nasi lemak + chicken rendang', 850, 'With condiments.', 3),
    ('Nasi lemak + beef / lamb rendang tok', 1050, 'With condiments.', 4),
    ('Nasi kerabu + chicken goreng rempah', 850, 'With condiments.', 5),
    ('Nasi kerabu + Thai curry', 850, 'With condiments.', 6),
    ('Nasi kerabu + beef / lamb rendang tok', 1050, 'With condiments.', 7),
    ('Nasi tomato + chicken masak merah', 850, 'With condiments.', 8),
    ('Nasi tomato + beef / lamb rendang tok', 1050, 'With condiments.', 9),
    ('Combo: any chicken dish + beef / lamb', 1200, null, 10),
    ('Mee kari', 850, null, 11),
    ('Kuih-muih', 100, null, 12),
    ('Teh tarik / Bandung soda', 250, null, 13)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Nora', 'Satay · nasi lemak', '{}'::text[], 7)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Chicken satay', 1000, null, 1),
    ('Nasi lemak', 1000, null, 2),
    ('Kuih-muih', 200, null, 3)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Popis By Mika', 'Popiah · rice', '{}'::text[], 8)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Nasi ayam masak merah', null, null, 1),
    ('Banqha popiah (3 pieces)', null, null, 2),
    ('Milo ais', null, null, 3),
    ('Ribena lychee', null, null, 4)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Pasar Pagi', 'Street snacks · desserts', '{}'::text[], 9)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Pisang goreng', null, null, 1),
    ('Kolok mee', null, null, 2),
    ('Basque burnt cheesecake cupcake', null, null, 3),
    ('Teh tarik', null, null, 4)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Penghulu Cantik Corner', 'Kuih · desserts', '{}'::text[], 10)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Kek tapak kuda', null, null, 1),
    ('Sagu mangga', null, null, 2),
    ('Dendeng daging', null, null, 3)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Mnight', 'Snacks · desserts · drinks', '{}'::text[], 11)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Nuggets', 200, null, 1),
    ('Tiramisu', 500, null, 2),
    ('Kek batik', 400, null, 3),
    ('Ribena soda mint', 200, null, 4),
    ('Milo (cold)', 200, null, 5),
    ('Sago gula melaka', 200, null, 6),
    ('Onion rings', 200, null, 7)
) as item(name, price_pence, description, sort_order);

with stall as (
  insert into vendors (name, cuisine, tags, sort_order)
  values ('Makan Nyaman', 'Sarawakian', '{}'::text[], 12)
  returning id
)
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select stall.id, item.name, item.price_pence::integer, item.description::text, item.sort_order
from stall, (values
    ('Laksa Sarawak', null, null, 1),
    ('Karipap', null, null, 2),
    ('Tiramisu cake', null, null, 3),
    ('Kuih', null, null, 4)
) as item(name, price_pence, description, sort_order);

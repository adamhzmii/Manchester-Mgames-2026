-- The stalls' final menus and pre-order contacts, as the vendors sent them.
--
-- A stall can now show how to reach it: a line ("Pre-order: +44 …") and where
-- it leads (a phone number, WhatsApp, Instagram). matcham yes, Kedai Kita and
-- Nora are unchanged; Warung MCOT is new.

alter table vendors
  add column if not exists contact text,
  add column if not exists contact_href text;

update vendors set name = 'The Chilli Tales' where name = 'Chili Tales';
update vendors set name = 'MNight' where name = 'Mnight';

insert into vendors (name, cuisine, tags, sort_order)
select 'Warung MCOT', 'Fried chicken · snacks', '{}'::text[], 13
where not exists (select 1 from vendors where name = 'Warung MCOT');

-- Kia Kitchen
delete from menu_items where vendor_id in (select id from vendors where name = 'Kia Kitchen');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Nasi ayam penyet', 900, null, 1),
    ('Nasi beef rendang', 1000, null, 2),
    ('Nasi ayam rendang', 900, null, 3),
    ('Nasi kuning ayam', 900, null, 4),
    ('Ice cendol', 450, null, 5),
    ('Juice susu kacang ijo', 400, 'Mung bean milk juice', 6),
    ('Kuih talam pandan', 150, null, 7),
    ('Kuih sarang semut', 150, 'Honeycomb cake', 8),
    ('Onde-onde pandan', 150, null, 9),
    ('Kuih ijo lumpang', 150, null, 10),
    ('Kuih pisang nagasari', 150, null, 11),
    ('Lemper ayam', 250, 'Pulut ketan', 12),
    ('Risoles', 250, null, 13)
) as x(name, price_pence, description, sort_order)
where v.name = 'Kia Kitchen';

-- Selera Pantai Timur
delete from menu_items where vendor_id in (select id from vendors where name = 'Selera Pantai Timur');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Nasi kerabu Abe Nik', 1000, null, 1),
    ('Nasi ala Kak Wok', 1000, null, 2)
) as x(name, price_pence, description, sort_order)
where v.name = 'Selera Pantai Timur';

-- Makan Nyaman
delete from menu_items where vendor_id in (select id from vendors where name = 'Makan Nyaman');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Laksa Sarawak', 1000, null, 1),
    ('Karipap pusing ayam (3 pcs)', 500, null, 2),
    ('Karipap pusing sardine (3 pcs)', 500, null, 3),
    ('Kuih talam (5 pcs)', 500, null, 4),
    ('Kek batik indulgence', 600, null, 5),
    ('Kek batik', 500, null, 6)
) as x(name, price_pence, description, sort_order)
where v.name = 'Makan Nyaman';

-- Penghulu Cantik Corner
delete from menu_items where vendor_id in (select id from vendors where name = 'Penghulu Cantik Corner');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Kek tapak kuda', 500, null, 1),
    ('Sagu mangga', 300, null, 2),
    ('Dendeng daging', 650, null, 3)
) as x(name, price_pence, description, sort_order)
where v.name = 'Penghulu Cantik Corner';

-- MNight
delete from menu_items where vendor_id in (select id from vendors where name = 'MNight');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Nuggets', 200, null, 1),
    ('Onion rings', 200, null, 2),
    ('Snack platter combo', 350, 'Onion rings + nuggets', 3),
    ('Tiramisu', 400, null, 4),
    ('Kek batik', 100, null, 5),
    ('Sago gula Melaka', 200, null, 6),
    ('Ribena soda mint', 200, null, 7),
    ('Thai green tea', 200, null, 8)
) as x(name, price_pence, description, sort_order)
where v.name = 'MNight';

-- Warung MCOT
delete from menu_items where vendor_id in (select id from vendors where name = 'Warung MCOT');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Ayam gunting', 500, null, 1),
    ('Enoki gunting (3 pcs)', 500, null, 2),
    ('ExtraJoss anggur', 200, null, 3)
) as x(name, price_pence, description, sort_order)
where v.name = 'Warung MCOT';

-- The Chilli Tales
delete from menu_items where vendor_id in (select id from vendors where name = 'The Chilli Tales');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Nasi lemak (regular)', 500, null, 1),
    ('Nasi lemak chicken goreng rempah', 850, null, 2),
    ('Nasi lemak chicken rendang', 850, null, 3),
    ('Nasi lemak beef rendang', 1050, null, 4),
    ('Nasi tomato chicken masak merah', 850, null, 5),
    ('Nasi tomato combo chicken & beef', 1150, null, 6),
    ('Nasi kerabu chicken goreng rempah', 850, null, 7),
    ('Nasi kerabu chicken Thai curry', 850, null, 8),
    ('Nasi kerabu beef rendang', 1050, null, 9),
    ('Mee curry', 850, null, 10),
    ('Karipap', 100, null, 11),
    ('Bingka pandan', 100, null, 12),
    ('Seri muka', 100, null, 13),
    ('Teh tarik', 220, null, 14),
    ('Bandung soda', 220, null, 15)
) as x(name, price_pence, description, sort_order)
where v.name = 'The Chilli Tales';

-- Tiny Tempeh Liverpool
delete from menu_items where vendor_id in (select id from vendors where name = 'Tiny Tempeh Liverpool');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Nasi lemak ayam rempah', 950, null, 1),
    ('Nasi lemak + egg (V)', 750, null, 2),
    ('Bee hoon goreng + fried egg', 750, null, 3),
    ('Mee goreng + fried egg', 800, null, 4),
    ('Nasi tomato ayam masak merah + acar', 1000, null, 5),
    ('Karipap', 120, 'Ayam kentang, sardine kentang or kentang (V)', 6),
    ('Sago gula Melaka', 300, 'Per tub', 7)
) as x(name, price_pence, description, sort_order)
where v.name = 'Tiny Tempeh Liverpool';

-- Popis By Mika
delete from menu_items where vendor_id in (select id from vendors where name = 'Popis By Mika');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Ayam masak merah', 850, null, 1),
    ('Nasi ayam Hainanese', 900, null, 2),
    ('Popis', 550, null, 3),
    ('Milo ais', 250, null, 4),
    ('Ribena lychee', 250, null, 5)
) as x(name, price_pence, description, sort_order)
where v.name = 'Popis By Mika';

-- Pasar Pagi
delete from menu_items where vendor_id in (select id from vendors where name = 'Pasar Pagi');
insert into menu_items (vendor_id, name, price_pence, description, sort_order)
select v.id, x.name, x.price_pence::integer, x.description::text, x.sort_order
from vendors v, (values
    ('Pisang goreng', 300, 'Add cheese +50p', 1),
    ('Kolo mee', 700, null, 2),
    ('Basque burnt cheesecake cupcake', null, null, 3),
    ('Teh tarik', 200, null, 4)
) as x(name, price_pence, description, sort_order)
where v.name = 'Pasar Pagi';

update vendors set contact = 'Pre-order: +44 7367 462627', contact_href = 'tel:+447367462627' where name = 'Kia Kitchen';
update vendors set contact = 'Contact: +44 7706 683103', contact_href = 'tel:+447706683103' where name = 'Selera Pantai Timur';
update vendors set contact = 'WhatsApp: +60 14-608 2122', contact_href = 'https://wa.me/60146082122' where name = 'MNight';
update vendors set contact = 'Pre-order: DM @thechillitales on Instagram', contact_href = 'https://instagram.com/thechillitales', instagram = 'thechillitales' where name = 'The Chilli Tales';
update vendors set contact = 'Pre-order: 07791 640086', contact_href = 'tel:+447791640086' where name = 'Tiny Tempeh Liverpool';
update vendors set contact = 'Contact: +44 7831 114952', contact_href = 'tel:+447831114952', instagram = 'popisbymika' where name = 'Popis By Mika';
update vendors set contact = 'Pre-order: +44 7990 971593', contact_href = 'tel:+447990971593' where name = 'Pasar Pagi';

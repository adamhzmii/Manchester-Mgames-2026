-- "Denmark Road" wrapped onto two lines in a game row's venue column, making
-- every football row taller than the rest. The short name is the one rows
-- use; the full name stays "Denmark Road Sports Centre".
update venues set short_name = 'Denmark Rd' where slug = 'denmark-road';

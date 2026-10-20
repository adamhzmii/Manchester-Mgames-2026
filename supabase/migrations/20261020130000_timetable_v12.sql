-- Fixture schedule version 12, applied in place: the games that moved get
-- their new kick-off, and the entries that changed are renamed. Ids stay the
-- same, so followed teams, shared match links and calendar entries keep
-- working. (tools/schedule-2026.json holds version 12 for a full rebuild.)

update teams set name = 'Faramir' where name = 'Temu Kodai' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'badminton' and c.slug = 'ms');
update teams set name = 'Eason Lee' where name = 'Temu Axelsen' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'badminton' and c.slug = 'ms');
update teams set name = 'Wing & Wong' where name = 'BAM' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'badminton' and c.slug = 'md');
update fixtures set scheduled_time = '2026-10-24 09:30+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('6eer6ellyFC', 'Glasgow'))
  and team_b_id in (select id from teams where name in ('6eer6ellyFC', 'Glasgow'))
  and scheduled_time = '2026-10-24 11:00+01';
update fixtures set scheduled_time = '2026-10-24 09:30+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('Hombres FT', 'Woxbridge United'))
  and team_b_id in (select id from teams where name in ('Hombres FT', 'Woxbridge United'))
  and scheduled_time = '2026-10-24 11:00+01';
update fixtures set scheduled_time = '2026-10-24 09:30+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('Maui', 'Bankfield All Star FC'))
  and team_b_id in (select id from teams where name in ('Maui', 'Bankfield All Star FC'))
  and scheduled_time = '2026-10-24 11:00+01';
update fixtures set scheduled_time = '2026-10-24 09:45+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('Woman United (U21)', 'Asam Pedas'))
  and team_b_id in (select id from teams where name in ('Woman United (U21)', 'Asam Pedas'))
  and scheduled_time = '2026-10-24 11:15+01';
update fixtures set scheduled_time = '2026-10-24 09:45+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('LumFC', 'RTJ'))
  and team_b_id in (select id from teams where name in ('LumFC', 'RTJ'))
  and scheduled_time = '2026-10-24 11:15+01';
update fixtures set scheduled_time = '2026-10-24 09:45+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('Fourteen', '6ola 6oys'))
  and team_b_id in (select id from teams where name in ('Fourteen', '6ola 6oys'))
  and scheduled_time = '2026-10-24 11:15+01';
update fixtures set scheduled_time = '2026-10-24 11:00+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('MCCH', 'DUMAS'))
  and team_b_id in (select id from teams where name in ('MCCH', 'DUMAS'))
  and scheduled_time = '2026-10-24 09:30+01';
update fixtures set scheduled_time = '2026-10-24 11:00+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('Siu', 'Anak Harimau'))
  and team_b_id in (select id from teams where name in ('Siu', 'Anak Harimau'))
  and scheduled_time = '2026-10-24 09:30+01';
update fixtures set scheduled_time = '2026-10-24 11:00+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('MSSM', 'Aadi and friends'))
  and team_b_id in (select id from teams where name in ('MSSM', 'Aadi and friends'))
  and scheduled_time = '2026-10-24 09:30+01';
update fixtures set scheduled_time = '2026-10-24 11:15+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('Geng Bangku FC', 'CGB'))
  and team_b_id in (select id from teams where name in ('Geng Bangku FC', 'CGB'))
  and scheduled_time = '2026-10-24 09:45+01';
update fixtures set scheduled_time = '2026-10-24 11:15+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('Avengers FC', 'Haram Ballerz'))
  and team_b_id in (select id from teams where name in ('Avengers FC', 'Haram Ballerz'))
  and scheduled_time = '2026-10-24 09:45+01';
update fixtures set scheduled_time = '2026-10-24 11:15+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'football')
  and team_a_id in (select id from teams where name in ('muiz.pdfc', 'Brexit Hasta City FC'))
  and team_b_id in (select id from teams where name in ('muiz.pdfc', 'Brexit Hasta City FC'))
  and scheduled_time = '2026-10-24 09:45+01';
update fixtures set scheduled_time = '2026-10-24 08:52+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('Bristolen', 'Stallions B'))
  and team_b_id in (select id from teams where name in ('Bristolen', 'Stallions B'))
  and scheduled_time = '2026-10-24 10:42+01';
update fixtures set scheduled_time = '2026-10-24 09:14+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('Beefsteaks', 'Stallions C'))
  and team_b_id in (select id from teams where name in ('Beefsteaks', 'Stallions C'))
  and scheduled_time = '2026-10-24 08:52+01';
update fixtures set scheduled_time = '2026-10-24 09:36+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('Bounce', 'Mamak Teh Beng'))
  and team_b_id in (select id from teams where name in ('Bounce', 'Mamak Teh Beng'))
  and scheduled_time = '2026-10-24 11:04+01';
update fixtures set scheduled_time = '2026-10-24 09:58+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('alliGato', 'Beefsteaks'))
  and team_b_id in (select id from teams where name in ('alliGato', 'Beefsteaks'))
  and scheduled_time = '2026-10-24 09:14+01';
update fixtures set scheduled_time = '2026-10-24 10:20+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('Bristolen', 'Bounce'))
  and team_b_id in (select id from teams where name in ('Bristolen', 'Bounce'))
  and scheduled_time = '2026-10-24 11:26+01';
update fixtures set scheduled_time = '2026-10-24 10:42+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('Mamak Sirap Ais', 'Stallions C'))
  and team_b_id in (select id from teams where name in ('Mamak Sirap Ais', 'Stallions C'))
  and scheduled_time = '2026-10-24 09:36+01';
update fixtures set scheduled_time = '2026-10-24 11:04+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('Stallions B', 'Mamak Teh Beng'))
  and team_b_id in (select id from teams where name in ('Stallions B', 'Mamak Teh Beng'))
  and scheduled_time = '2026-10-24 11:48+01';
update fixtures set scheduled_time = '2026-10-24 11:26+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('alliGato', 'Stallions C'))
  and team_b_id in (select id from teams where name in ('alliGato', 'Stallions C'))
  and scheduled_time = '2026-10-24 09:58+01';
update fixtures set scheduled_time = '2026-10-24 11:48+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('Bristolen', 'Mamak Teh Beng'))
  and team_b_id in (select id from teams where name in ('Bristolen', 'Mamak Teh Beng'))
  and scheduled_time = '2026-10-24 12:10+01';
update fixtures set scheduled_time = '2026-10-24 12:10+01'
where stage = 'group' and category_id in (select c.id from categories c join sports s on s.id = c.sport_id where s.slug = 'frisbee')
  and team_a_id in (select id from teams where name in ('Mamak Sirap Ais', 'Beefsteaks'))
  and team_b_id in (select id from teams where name in ('Mamak Sirap Ais', 'Beefsteaks'))
  and scheduled_time = '2026-10-24 10:20+01';

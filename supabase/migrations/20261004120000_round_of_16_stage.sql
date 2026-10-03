-- A round of 16, for a football tournament the size of 2025's: six groups of
-- four, with the top two and the four best third-placed teams going through.
--
-- Additive: no existing row changes, and nothing reads the new value until a
-- fixture is created with it.
alter type fixture_stage add value if not exists 'round_of_16' before 'quarterfinal';

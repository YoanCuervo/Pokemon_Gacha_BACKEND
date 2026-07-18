-- =====================================================================
-- 002_seed.sql — pokemon_gacha
-- Ordre imperatif : stones -> users -> pokemon (stades finaux d'abord)
--                   -> pokemon_instances
-- v3.1 : base_spe (Sp.Atk Gen 2) et base_spd (Sp.Def Gen 2) ajoutees.
--        Source uniforme pour le futur import API Gen 1+2.
--        ATTAQUE = ATT + SPE / VIE = HP + DEF + SPD : rien n'est jete.
-- =====================================================================
-- ---------------------------------------------------------------------
-- 1. STONES (17 types Gen 1-2)
-- ---------------------------------------------------------------------
INSERT INTO stones (name, pokemon_type) VALUES
  ('Moon Stone',     'normal'),
  ('Fire Stone',     'fire'),
  ('Water Stone',    'water'),
  ('Electric Stone', 'electric'),
  ('Leaf Stone',     'grass'),
  ('Ice Stone',      'ice'),
  ('Fighting Stone', 'fighting'),
  ('Poison Stone',   'poison'),
  ('Earth Stone',    'ground'),
  ('Sky Stone',      'flying'),
  ('Psychic Stone',  'psychic'),
  ('Bug Stone',      'bug'),
  ('Rock Stone',     'rock'),
  ('Ghost Stone',    'ghost'),
  ('Dragon Stone',   'dragon'),
  ('Dark Stone',     'dark'),
  ('Steel Stone',    'steel');
-- ---------------------------------------------------------------------
-- 2. USERS
-- ---------------------------------------------------------------------
INSERT INTO users (email, password_hash, display_name, country, level, xp) VALUES
  ('pokegacha@test.com', 'FAKE_PASSWORD', 'Nerub', 'FR', 1, 0);
-- ---------------------------------------------------------------------
-- 3. POKEMON — ids = Pokedex.
--    evolves_into_id est auto-referent : stades FINAUX en premier.
--    base_spe = Sp.Atk Gen 2 / base_spd = Sp.Def Gen 2.
-- ---------------------------------------------------------------------
-- Ligne Bulbizarre (evolution_line_id = 1)
INSERT INTO pokemon
  (id, name, evolution_line_id, evolution_stage, evolves_into_id,
   stone_id, stone_cost, type_primary, type_secondary,
   base_atk, base_spe, base_hp, base_def, base_spd, base_speed, generation)
VALUES
  (3, 'Venusaur',  1, 2, NULL, NULL, NULL, 'grass', 'poison', 82, 100, 80, 83, 100, 80, 1),
  (2, 'Ivysaur',   1, 1,    3,    5,  200, 'grass', 'poison', 62,  80, 60, 63,  80, 60, 1),
  (1, 'Bulbasaur', 1, 0,    2,    5,  100, 'grass', 'poison', 49,  65, 45, 49,  65, 45, 1);
-- Ligne Salameche (evolution_line_id = 4)
INSERT INTO pokemon
  (id, name, evolution_line_id, evolution_stage, evolves_into_id,
   stone_id, stone_cost, type_primary, type_secondary,
   base_atk, base_spe, base_hp, base_def, base_spd, base_speed, generation)
VALUES
  (6, 'Charizard',  4, 2, NULL, NULL, NULL, 'fire', 'flying', 84, 109, 78, 78, 85, 100, 1),
  (5, 'Charmeleon', 4, 1,    6,    2,  200, 'fire', NULL,     64,  80, 58, 58, 65,  80, 1),
  (4, 'Charmander', 4, 0,    5,    2,  100, 'fire', NULL,     52,  60, 39, 43, 50,  65, 1);
-- Ligne Carapuce (evolution_line_id = 7)
INSERT INTO pokemon
  (id, name, evolution_line_id, evolution_stage, evolves_into_id,
   stone_id, stone_cost, type_primary, type_secondary,
   base_atk, base_spe, base_hp, base_def, base_spd, base_speed, generation)
VALUES
  (9, 'Blastoise', 7, 2, NULL, NULL, NULL, 'water', NULL, 83, 85, 79, 100, 105, 78, 1),
  (8, 'Wartortle', 7, 1,    9,    3,  200, 'water', NULL, 63, 65, 59,  80,  80, 58, 1),
  (7, 'Squirtle',  7, 0,    8,    3,  100, 'water', NULL, 48, 50, 44,  65,  64, 43, 1);
-- ---------------------------------------------------------------------
-- 4. POKEMON_INSTANCES (10) — doublons volontaires
--    instance_id 3 = Charmander shiny / instance_id 4 = Charizard Nv41 5*
-- ---------------------------------------------------------------------
INSERT INTO pokemon_instances
  (user_id, pokemon_id, stars, star_progress, is_shiny, level, xp)
VALUES
  (1, 4, 3,  40, FALSE, 22, 3100),   -- Charmander  3 etoiles
  (1, 4, 1,  12, FALSE,  5,  680),   -- Charmander  doublon
  (1, 4, 2,   0, TRUE,   9, 4900),   -- Charmander  doublon shiny
  (1, 6, 5,   0, FALSE, 41, 7450),   -- Charizard   5 etoiles, le carry
  (1, 1, 4, 180, FALSE, 30, 7450),   -- Bulbasaur   4 etoiles
  (1, 2, 2,  35, FALSE, 14, 2070),   -- Ivysaur
  (1, 9, 4, 210, FALSE, 28, 7450),   -- Blastoise
  (1, 7, 1,  20, FALSE,  3,  250),   -- Squirtle
  (1, 7, 1,   5, FALSE,  1,    0),   -- Squirtle    doublon
  (1, 8, 3,  75, FALSE, 18, 3200);   -- Wartortle
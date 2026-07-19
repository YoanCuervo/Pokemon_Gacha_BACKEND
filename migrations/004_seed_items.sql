-- =====================================================================
-- 004_seed_items.sql — pokemon_gacha
-- Catalogue FIGE (19/07) :
--   Uniques      base 40, courbe x0.75/x1/x1.5/x2/x2.5 -> 30/40/60/80/100
--   Items type   base 50, courbe x0.25/x0.5/x1/x1.5/x2 -> 12/25/50/75/100
--   Vive Griffe  base 20, courbe normale               ->  5/10/20/30/40
--   Slot spe     base 20 (le role EST la valeur) :
--     Orbe Vie (unique)      -> 15/20/30/40/50
--     Lentilscope            ->  5/10/20/30/40 (crit 5/10/15/20/25% via rarete)
--     Ceinture de Force      -> 40 (mythic only, non-unique)
--     Accro Griffe           -> 50 (mythic only, UNIQUE)
-- Regle v3.1 verifiee a la main : att/def/speed -> mode NULL ;
-- spe -> mode obligatoire. is_unique = possession par NOM.
-- =====================================================================
USE pokemon_gacha;

-- ---------------------------------------------------------------------
-- 1. UNIQUES (ids 1-15) — Bandeau Choix / Restes / Foulard Choix
-- ---------------------------------------------------------------------
INSERT INTO item_templates (id, name, category, required_type, mode, rarity, is_unique, boost_value) VALUES
  ( 1, 'Choice Band',  'att',   NULL, NULL, 'common',     TRUE,  30),
  ( 2, 'Choice Band',  'att',   NULL, NULL, 'rare',       TRUE,  40),
  ( 3, 'Choice Band',  'att',   NULL, NULL, 'ultra_rare', TRUE,  60),
  ( 4, 'Choice Band',  'att',   NULL, NULL, 'legendary',  TRUE,  80),
  ( 5, 'Choice Band',  'att',   NULL, NULL, 'mythic',     TRUE, 100),
  ( 6, 'Leftovers',    'def',   NULL, NULL, 'common',     TRUE,  30),
  ( 7, 'Leftovers',    'def',   NULL, NULL, 'rare',       TRUE,  40),
  ( 8, 'Leftovers',    'def',   NULL, NULL, 'ultra_rare', TRUE,  60),
  ( 9, 'Leftovers',    'def',   NULL, NULL, 'legendary',  TRUE,  80),
  (10, 'Leftovers',    'def',   NULL, NULL, 'mythic',     TRUE, 100),
  (11, 'Choice Scarf', 'speed', NULL, NULL, 'common',     TRUE,  30),
  (12, 'Choice Scarf', 'speed', NULL, NULL, 'rare',       TRUE,  40),
  (13, 'Choice Scarf', 'speed', NULL, NULL, 'ultra_rare', TRUE,  60),
  (14, 'Choice Scarf', 'speed', NULL, NULL, 'legendary',  TRUE,  80),
  (15, 'Choice Scarf', 'speed', NULL, NULL, 'mythic',     TRUE, 100);

-- ---------------------------------------------------------------------
-- 2. ITEMS DE TYPE — ATT (ids 101-145, 9 types x 5 raretes)
-- ---------------------------------------------------------------------
INSERT INTO item_templates (id, name, category, required_type, mode, rarity, is_unique, boost_value) VALUES
  (101,'Dragon Fang','att','dragon',  NULL,'common',FALSE,12),(102,'Dragon Fang','att','dragon',  NULL,'rare',FALSE,25),(103,'Dragon Fang','att','dragon',  NULL,'ultra_rare',FALSE,50),(104,'Dragon Fang','att','dragon',  NULL,'legendary',FALSE,75),(105,'Dragon Fang','att','dragon',  NULL,'mythic',FALSE,100),
  (106,'Charcoal',   'att','fire',    NULL,'common',FALSE,12),(107,'Charcoal',   'att','fire',    NULL,'rare',FALSE,25),(108,'Charcoal',   'att','fire',    NULL,'ultra_rare',FALSE,50),(109,'Charcoal',   'att','fire',    NULL,'legendary',FALSE,75),(110,'Charcoal',   'att','fire',    NULL,'mythic',FALSE,100),
  (111,'Black Belt', 'att','fighting',NULL,'common',FALSE,12),(112,'Black Belt', 'att','fighting',NULL,'rare',FALSE,25),(113,'Black Belt', 'att','fighting',NULL,'ultra_rare',FALSE,50),(114,'Black Belt', 'att','fighting',NULL,'legendary',FALSE,75),(115,'Black Belt', 'att','fighting',NULL,'mythic',FALSE,100),
  (116,'Spell Tag',  'att','ghost',   NULL,'common',FALSE,12),(117,'Spell Tag',  'att','ghost',   NULL,'rare',FALSE,25),(118,'Spell Tag',  'att','ghost',   NULL,'ultra_rare',FALSE,50),(119,'Spell Tag',  'att','ghost',   NULL,'legendary',FALSE,75),(120,'Spell Tag',  'att','ghost',   NULL,'mythic',FALSE,100),
  (121,'Light Ball', 'att','electric',NULL,'common',FALSE,12),(122,'Light Ball', 'att','electric',NULL,'rare',FALSE,25),(123,'Light Ball', 'att','electric',NULL,'ultra_rare',FALSE,50),(124,'Light Ball', 'att','electric',NULL,'legendary',FALSE,75),(125,'Light Ball', 'att','electric',NULL,'mythic',FALSE,100),
  (126,'Never-Melt Ice','att','ice',  NULL,'common',FALSE,12),(127,'Never-Melt Ice','att','ice',  NULL,'rare',FALSE,25),(128,'Never-Melt Ice','att','ice',  NULL,'ultra_rare',FALSE,50),(129,'Never-Melt Ice','att','ice',  NULL,'legendary',FALSE,75),(130,'Never-Melt Ice','att','ice',  NULL,'mythic',FALSE,100),
  (131,'Soft Sand',  'att','ground',  NULL,'common',FALSE,12),(132,'Soft Sand',  'att','ground',  NULL,'rare',FALSE,25),(133,'Soft Sand',  'att','ground',  NULL,'ultra_rare',FALSE,50),(134,'Soft Sand',  'att','ground',  NULL,'legendary',FALSE,75),(135,'Soft Sand',  'att','ground',  NULL,'mythic',FALSE,100),
  (136,'Hard Stone', 'att','rock',    NULL,'common',FALSE,12),(137,'Hard Stone', 'att','rock',    NULL,'rare',FALSE,25),(138,'Hard Stone', 'att','rock',    NULL,'ultra_rare',FALSE,50),(139,'Hard Stone', 'att','rock',    NULL,'legendary',FALSE,75),(140,'Hard Stone', 'att','rock',    NULL,'mythic',FALSE,100),
  (141,'Twisted Spoon','att','psychic',NULL,'common',FALSE,12),(142,'Twisted Spoon','att','psychic',NULL,'rare',FALSE,25),(143,'Twisted Spoon','att','psychic',NULL,'ultra_rare',FALSE,50),(144,'Twisted Spoon','att','psychic',NULL,'legendary',FALSE,75),(145,'Twisted Spoon','att','psychic',NULL,'mythic',FALSE,100);

-- ---------------------------------------------------------------------
-- 3. ITEMS DE TYPE — DEF (ids 201-240, 8 types x 5 raretes)
-- ---------------------------------------------------------------------
INSERT INTO item_templates (id, name, category, required_type, mode, rarity, is_unique, boost_value) VALUES
  (201,'Black Glasses','def','dark',  NULL,'common',FALSE,12),(202,'Black Glasses','def','dark',  NULL,'rare',FALSE,25),(203,'Black Glasses','def','dark',  NULL,'ultra_rare',FALSE,50),(204,'Black Glasses','def','dark',  NULL,'legendary',FALSE,75),(205,'Black Glasses','def','dark',  NULL,'mythic',FALSE,100),
  (206,'Iron Plate',  'def','steel',  NULL,'common',FALSE,12),(207,'Iron Plate',  'def','steel',  NULL,'rare',FALSE,25),(208,'Iron Plate',  'def','steel',  NULL,'ultra_rare',FALSE,50),(209,'Iron Plate',  'def','steel',  NULL,'legendary',FALSE,75),(210,'Iron Plate',  'def','steel',  NULL,'mythic',FALSE,100),
  (211,'Mystic Water','def','water',  NULL,'common',FALSE,12),(212,'Mystic Water','def','water',  NULL,'rare',FALSE,25),(213,'Mystic Water','def','water',  NULL,'ultra_rare',FALSE,50),(214,'Mystic Water','def','water',  NULL,'legendary',FALSE,75),(215,'Mystic Water','def','water',  NULL,'mythic',FALSE,100),
  (216,'Miracle Seed','def','grass',  NULL,'common',FALSE,12),(217,'Miracle Seed','def','grass',  NULL,'rare',FALSE,25),(218,'Miracle Seed','def','grass',  NULL,'ultra_rare',FALSE,50),(219,'Miracle Seed','def','grass',  NULL,'legendary',FALSE,75),(220,'Miracle Seed','def','grass',  NULL,'mythic',FALSE,100),
  (221,'Poison Barb', 'def','poison', NULL,'common',FALSE,12),(222,'Poison Barb', 'def','poison', NULL,'rare',FALSE,25),(223,'Poison Barb', 'def','poison', NULL,'ultra_rare',FALSE,50),(224,'Poison Barb', 'def','poison', NULL,'legendary',FALSE,75),(225,'Poison Barb', 'def','poison', NULL,'mythic',FALSE,100),
  (226,'Sharp Beak',  'def','flying', NULL,'common',FALSE,12),(227,'Sharp Beak',  'def','flying', NULL,'rare',FALSE,25),(228,'Sharp Beak',  'def','flying', NULL,'ultra_rare',FALSE,50),(229,'Sharp Beak',  'def','flying', NULL,'legendary',FALSE,75),(230,'Sharp Beak',  'def','flying', NULL,'mythic',FALSE,100),
  (231,'Silk Scarf',  'def','normal', NULL,'common',FALSE,12),(232,'Silk Scarf',  'def','normal', NULL,'rare',FALSE,25),(233,'Silk Scarf',  'def','normal', NULL,'ultra_rare',FALSE,50),(234,'Silk Scarf',  'def','normal', NULL,'legendary',FALSE,75),(235,'Silk Scarf',  'def','normal', NULL,'mythic',FALSE,100),
  (236,'Silver Powder','def','bug',   NULL,'common',FALSE,12),(237,'Silver Powder','def','bug',   NULL,'rare',FALSE,25),(238,'Silver Powder','def','bug',   NULL,'ultra_rare',FALSE,50),(239,'Silver Powder','def','bug',   NULL,'legendary',FALSE,75),(240,'Silver Powder','def','bug',   NULL,'mythic',FALSE,100);

-- ---------------------------------------------------------------------
-- 4. SPEED generique — Vive Griffe (ids 301-305)
-- ---------------------------------------------------------------------
INSERT INTO item_templates (id, name, category, required_type, mode, rarity, is_unique, boost_value) VALUES
  (301,'Quick Claw','speed',NULL,NULL,'common',FALSE, 5),
  (302,'Quick Claw','speed',NULL,NULL,'rare',  FALSE,10),
  (303,'Quick Claw','speed',NULL,NULL,'ultra_rare',FALSE,20),
  (304,'Quick Claw','speed',NULL,NULL,'legendary', FALSE,30),
  (305,'Quick Claw','speed',NULL,NULL,'mythic',    FALSE,40);

-- ---------------------------------------------------------------------
-- 5. SPE (ids 401-412) — le mode EST le role
-- ---------------------------------------------------------------------
INSERT INTO item_templates (id, name, category, required_type, mode, rarity, is_unique, boost_value) VALUES
  (401,'Life Orb',   'spe',NULL,'heal_lowest',  'common',    TRUE, 15),
  (402,'Life Orb',   'spe',NULL,'heal_left',    'rare',      TRUE, 20),
  (403,'Life Orb',   'spe',NULL,'heal_right',   'ultra_rare',TRUE, 30),
  (404,'Life Orb',   'spe',NULL,'heal_adjacent','legendary', TRUE, 40),
  (405,'Life Orb',   'spe',NULL,'heal_all',     'mythic',    TRUE, 50),
  (406,'Scope Lens', 'spe',NULL,'crit','common',    FALSE, 5),
  (407,'Scope Lens', 'spe',NULL,'crit','rare',      FALSE,10),
  (408,'Scope Lens', 'spe',NULL,'crit','ultra_rare',FALSE,20),
  (409,'Scope Lens', 'spe',NULL,'crit','legendary', FALSE,30),
  (410,'Scope Lens', 'spe',NULL,'crit','mythic',    FALSE,40),
  (411,'Focus Sash', 'spe',NULL,'taunt',       'mythic',FALSE,40),
  (412,'Accro Claw', 'spe',NULL,'atk_adjacent','mythic',TRUE, 50);

-- ---------------------------------------------------------------------
-- 6. ITEM_INSTANCES — jeu de test pour combat miroir PARLANT
--    (compo qui FINIT : 1 seul heal_left, pas de heal_lowest+taunt)
--    Rappel instances : 4=Charizard 5* Nv41 / 7=Blastoise 4* / 5=Bulbasaur 4*
--                       10=Wartortle 3* / 1=Charmander 3*
-- ---------------------------------------------------------------------
INSERT INTO item_instances (user_id, item_template_id, category, pokemon_instance_id) VALUES
  -- Charizard, le carry : crit mythic + Bandeau mythic + Charbon mythic (fire OK)
  (1,   5, 'att',   4),
  (1, 110, 'att',   NULL),  -- 2e Charbon en reserve (test uq_ii_equip cote UI)
  (1, 410, 'spe',   4),
  (1, 305, 'speed', 4),
  -- Blastoise, le tank : taunt + Restes mythic + Eau Mystique legendaire (water OK)
  (1, 411, 'spe',   7),
  (1,  10, 'def',   7),
  (1, 214, 'def',   NULL),  -- en reserve : uq_ii_equip interdit 2 def equipes
  -- Bulbasaur : le healer (Orbe Vie rare = heal_left)
  (1, 402, 'spe',   5),
  -- Wartortle : le cliveur (Accro Griffe)
  (1, 412, 'spe',  10),
  -- Charmander : Charbon ultra rare (fire OK) + Foulard Choix rare
  (1, 108, 'att',   1),
  (1,  12, 'speed', 1);
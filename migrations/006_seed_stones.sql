-- 006_seed_stones.sql — pokemon_gacha
-- =====================================================================
-- Pierres d'evolution du joueur de dev (user_id = 1).
-- Alimente l'onglet A (Evolution) avec des etats varies, normaux ET shiny.
--
-- DEPENDANCE : 005_shiny_evolution.sql doit tourner AVANT (il cree la
-- ligne Shiny Stone que ce seed distribue). Ordre : 005 puis 006.
--
-- Etats couverts (avec les instances de 002_seed) :
--   NORMAUX (pierre du type, cout de base) :
--   - Fire  150 -> Charmander normal (inst 1, cout 100) EVOLUABLE + rab.
--   - Water  50 -> Squirtle   (inst 8, cout 100) PAS ASSEZ (50/100).
--   - Leaf  200 -> Bulbasaur  (inst 5, cout 100) EVOLUABLE.
--   SHINY (Shiny Stone, cout x10) :
--   - Shiny 1200 -> Charmander SHINY (inst 3, cout 100x10=1000) EVOLUABLE.
--   Stades finaux (Charizard/Blastoise/Venusaur) : can_evolve=false.
--
-- REJOUABLE : ON DUPLICATE KEY UPDATE avec alias de ligne (AS new).
-- Remet les quantites (ne s'additionne pas). Idempotent.
--
-- ROBUSTE AUX IDs : stone_id resolu par pokemon_type, pas code en dur.
-- =====================================================================

USE pokemon_gacha;

INSERT INTO user_stones (user_id, stone_id, quantity)
VALUES
  (1, (SELECT id FROM stones WHERE pokemon_type = 'fire'),   150),
  (1, (SELECT id FROM stones WHERE pokemon_type = 'water'),   50),
  (1, (SELECT id FROM stones WHERE pokemon_type = 'grass'),  200),
  (1, (SELECT id FROM stones WHERE pokemon_type = 'shiny'), 1200)
AS new
ON DUPLICATE KEY UPDATE quantity = new.quantity;
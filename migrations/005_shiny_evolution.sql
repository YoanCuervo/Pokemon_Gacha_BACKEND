-- 005_shiny_evolution.sql — pokemon_gacha
-- =====================================================================
-- EVOLUTION DES SHINY (session 22/07)
--
-- Regle : un pokemon shiny evolue avec des SHINY STONES (pierre
-- universelle, une seule pour tous les types), au cout de l'espece
-- MULTIPLIE par shiny_evolution_multiplier (x10).
-- Un pokemon normal evolue avec la pierre de son type, cout de base.
-- L'espece cible et pokemon.stone_cost (cout DE BASE) ne changent pas :
-- c'est le SERVICE qui, pour un shiny, cible la Shiny Stone et applique
-- le multiplicateur a la volee. Aucune donnee dupliquee.
--
-- HORS PERIMETRE (dette explicite) : rendre un pokemon shiny. R4
-- (shiny_fragment_cost) reste en base mais la mecanique "devenir shiny"
-- n'est ni codee ni figee. On ne s'en sert pas ici.
--
-- 2 changements :
--   1. stones : + ligne ('Shiny Stone', 'shiny'). Le pseudo-type
--      'shiny' n'est pas un type Pokemon : c'est un marqueur qui
--      permet de resoudre la pierre par type (comme les autres) sans
--      coder son id en dur. L'UNIQUE sur pokemon_type l'accepte.
--   2. game_settings : + shiny_evolution_multiplier (10). Vit en base
--      pour rester reequilibrable par UPDATE (comme star_stat_coeff).
--
-- REJOUABLE : les deux INSERT sont idempotents (ON DUPLICATE KEY UPDATE).
-- Syntaxe alias de ligne (AS new) : remplace VALUES(col), deprecie
-- depuis MySQL 8.0.20.
-- =====================================================================

USE pokemon_gacha;

-- 1. La Shiny Stone (pierre d'evolution universelle des shiny).
--    pokemon_type = 'shiny' : pseudo-type marqueur, jamais porte par un
--    pokemon. Sert uniquement a resoudre la pierre par type.
INSERT INTO stones (name, pokemon_type)
VALUES ('Shiny Stone', 'shiny') AS new
ON DUPLICATE KEY UPDATE name = new.name;

-- 2. Le multiplicateur de cout d'evolution des shiny.
--    Cout shiny = pokemon.stone_cost * shiny_evolution_multiplier.
--    En base -> reequilibrable sans toucher au code (baisser a 5 ou 3
--    si le playtest montre que x10 est trop punitif).
INSERT INTO game_settings (setting_key, setting_value, description)
VALUES (
  'shiny_evolution_multiplier',
  10.0000,
  'Multiplicateur du cout d''evolution d''un shiny. Cout = stone_cost x ce facteur, paye en Shiny Stones.'
) AS new
ON DUPLICATE KEY UPDATE
  setting_value = new.setting_value,
  description   = new.description;
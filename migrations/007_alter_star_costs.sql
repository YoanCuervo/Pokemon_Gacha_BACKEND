-- 007_alter_star_costs.sql — pokemon_gacha
-- =====================================================================
-- REEQUILIBRAGE DES COUTS D'ETOILE (session 22/07)
--
-- Les valeurs initiales (25/50/100/250/500) ne collent pas a la regle
-- de decraft actee : un pokemon sacrifie rend la MOITIE du cout de son
-- niveau d'etoile. Avec les nouvelles valeurs, le rendement tombe juste :
--
--   Vers 1* : 50  -> decraft d'un 1* rend 25
--   Vers 2* : 100 -> decraft d'un 2* rend 50
--   Vers 3* : 150 -> decraft d'un 3* rend 75
--   Vers 4* : 300 -> decraft d'un 4* rend 150
--   Vers 5* : 500 -> decraft d'un 5* rend 250
--   (un 0* rend 1 : plancher, pas de cout d'etoile correspondant)
--
-- Le rendement du decraft n'est PAS stocke : il se derive de
-- star_costs / 2 cote service. Une seule source de verite.
--
-- REJOUABLE : UPDATE idempotent (memes valeurs si relance).
-- =====================================================================

USE pokemon_gacha;

UPDATE star_costs SET fragment_cost = 50  WHERE star_level = 1;
UPDATE star_costs SET fragment_cost = 100 WHERE star_level = 2;
UPDATE star_costs SET fragment_cost = 150 WHERE star_level = 3;
UPDATE star_costs SET fragment_cost = 300 WHERE star_level = 4;
UPDATE star_costs SET fragment_cost = 500 WHERE star_level = 5;
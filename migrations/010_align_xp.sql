-- 010_align_xp.sql — pokemon_gacha
-- =====================================================================
-- REALIGNEMENT XP / NIVEAU
--
-- Depuis l'onglet EXPERIENCE, le niveau DERIVE de l'xp : c'est le plus haut palier de level_costs dont xp_required <= xp. Les instances existantes ont des couples (level, xp) arbitraires, anterieurs au bareme complet (009) : un niveau 22 avec 3100 xp alors que le palier 22 en exige 19196. On garde le NIVEAU (l'intention du seed, ce que le joueur voit) et on reconstruit l'xp qui lui correspond : xp = xp_required du niveau. L'inverse (recalculer le niveau depuis l'xp) ferait chuter tous les pokemon de plusieurs dizaines de niveaux. Le pokemon repart donc au PLANCHER de son palier (progression du palier en cours remise a zero) : acceptable, cette progression n'existait pas vraiment avant. Les niveaux hors bareme (> 500) sont ramenes a 500.
-- REJOUABLE : l'operation est idempotente (rejouer ne change rien).
-- =====================================================================

USE pokemon_gacha;

-- Securite : aucun niveau au-dela du bareme.
UPDATE pokemon_instances
SET level = (SELECT MAX(level) FROM level_costs)
WHERE id > 0 AND level > (SELECT MAX(level) FROM level_costs);

-- xp = le cumul requis pour le niveau actuel.
UPDATE pokemon_instances pi
JOIN level_costs lc ON lc.level = pi.level
SET pi.xp = lc.xp_required
WHERE pi.id > 0;
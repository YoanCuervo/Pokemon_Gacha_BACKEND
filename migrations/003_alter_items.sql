-- =====================================================================
-- 003_alter_items.sql — pokemon_gacha (catalogue items figé le 19/07)
-- 1. required_type : items de type (boost conditionnel au type du porteur,
--    verif au calcul de stat cote service, jamais dans le moteur)
-- 2. is_unique : regle de POSSESSION (1 exemplaire par joueur, par NOM,
--    toutes raretes confondues). Portee par le futur service gacha ;
--    le catalogue porte la regle, pas le code.
-- 3. mode : + heal_all (Orbe Vie mythic). anticrit conserve dans l'ENUM
--    (supprime du catalogue ; retrait de l'ENUM au prochain menage).
-- =====================================================================
USE pokemon_gacha;

ALTER TABLE item_templates
  ADD COLUMN required_type VARCHAR(20) NULL AFTER category,
  ADD COLUMN is_unique BOOLEAN NOT NULL DEFAULT FALSE AFTER rarity,
  MODIFY COLUMN mode ENUM('taunt','crit','anticrit',
                          'heal_left','heal_right','heal_random',
                          'heal_lowest','heal_adjacent','heal_all',
                          'atk_adjacent') NULL;
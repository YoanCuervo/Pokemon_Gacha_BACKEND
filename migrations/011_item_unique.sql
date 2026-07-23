-- 011_item_unique.sql — pokemon_gacha
-- =====================================================================
-- ITEMS UNIQUES (design du 23/07)
--
-- Un item marque UNIQUE ne peut equiper qu'UN SEUL pokemon de la
-- lineup, meme si le joueur en possede plusieurs exemplaires. C'est
-- une regle de COMPOSITION, distincte de uq_ii_equip (qui empeche
-- seulement qu'une meme INSTANCE soit portee deux fois — trivialement
-- vrai, un objet physique n'est pas a deux endroits).
--
-- L'unicite est une propriete de l'ITEM, pas de sa rarete : Bandeau
-- Choix est unique dans ses 5 raretes, Lentilscope ne l'est dans
-- aucune.
--
-- PORTEE ACTUELLE : la regle n'est appliquee QUE dans le bac a sable.
-- Le jeu reel (equipement depuis l'inventaire) ne la verifie pas
-- encore — dette assumee, a solder au chantier Sac a dos.
--
-- REJOUABLE : ADD COLUMN IF NOT EXISTS + UPDATE idempotents.
-- =====================================================================

USE pokemon_gacha;

-- Par defaut un item n'est PAS unique : on ne marque que l'exception.
ALTER TABLE item_templates
  ADD COLUMN IF NOT EXISTS is_unique BOOLEAN NOT NULL DEFAULT FALSE;

-- Les items uniques, par NOM (toutes raretes confondues) :
--   Choice Band   — le boost d'attaque de reference
--   Leftovers     — le boost de defense de reference
--   Choice Scarf  — le boost de vitesse de reference
--   Grip Claw     — clive (degats adjacents)
--   Life Orb      — les soins (un mode different par rarete)
UPDATE item_templates
SET is_unique = TRUE
WHERE id > 0
  AND name IN (
    'Choice Band',
    'Leftovers',
    'Choice Scarf',
    'Grip Claw',
    'Life Orb'
  );

-- Securite : tout le reste reste non-unique (au cas ou la colonne
-- existait deja avec d'autres valeurs).
UPDATE item_templates
SET is_unique = FALSE
WHERE id > 0
  AND name NOT IN (
    'Choice Band',
    'Leftovers',
    'Choice Scarf',
    'Grip Claw',
    'Life Orb'
  );
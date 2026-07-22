-- 008_candies.sql — pokemon_gacha
-- =====================================================================
-- BONBONS XP (onglets PUISSANCE et EXPERIENCE)
--
-- Un seul type de bonbon. Fongible et consommable : on ne manipule
-- qu'une quantite, jamais une instance individuelle. Donc un POT
-- (comme user_stones / user_fragments), PAS des item_instances.
--
-- Deux sources :
--   - le decraft d'un pokemon rend 25% de son XP TOTALE, converti en
--     bonbons (1 bonbon = candy_xp_value XP)
--   - les combats (a venir) droppent des bonbons
--
-- Une seule utilisation : l'onglet EXPERIENCE en consomme N pour
-- ajouter N x candy_xp_value XP a une instance.
--
-- REJOUABLE : CREATE TABLE IF NOT EXISTS + INSERT idempotent.
-- =====================================================================

USE pokemon_gacha;

-- Le pot de bonbons du joueur. Un seul type aujourd'hui, mais la table
-- porte un candy_type pour ne pas avoir a la migrer si on en ajoute
-- (super-bonbon, etc.). 'xp' est le seul type pour l'instant.
CREATE TABLE IF NOT EXISTS user_candies (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  candy_type VARCHAR(20) NOT NULL DEFAULT 'xp',
  quantity   INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_uc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_uc (user_id, candy_type)
) ENGINE=InnoDB;

-- Combien d'XP vaut UN bonbon. En base -> reequilibrable par UPDATE.
-- Avec la courbe level_costs visee (niveau 500), 100 XP/bonbon donne
-- ~447 000 bonbons pour un pokemon max.
INSERT INTO game_settings (setting_key, setting_value, description)
VALUES (
  'candy_xp_value',
  100.0000,
  'XP apportee par un bonbon XP. Sert aussi a convertir l''XP rendue par le decraft en bonbons.'
) AS new
ON DUPLICATE KEY UPDATE
  setting_value = new.setting_value,
  description   = new.description;

-- Part de l'XP TOTALE d'un pokemon rendue lors de son decraft (0.25 = 25%).
INSERT INTO game_settings (setting_key, setting_value, description)
VALUES (
  'decraft_xp_refund_rate',
  0.2500,
  'Part de l''XP totale d''un pokemon rendue en bonbons lors de son decraft.'
) AS new
ON DUPLICATE KEY UPDATE
  setting_value = new.setting_value,
  description   = new.description;

-- Bonbons de depart pour tester (user de dev).
INSERT INTO user_candies (user_id, candy_type, quantity)
VALUES (1, 'xp', 50) AS new
ON DUPLICATE KEY UPDATE quantity = new.quantity;
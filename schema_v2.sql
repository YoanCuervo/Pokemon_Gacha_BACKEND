-- =====================================================================
-- POKEMON WEB GAME - SCHEMA v2
-- Perimetre : joueurs, profil, pokemon, equipe, items, fragments, evolution
-- Hors perimetre : gacha/packs, monnaies, PvP, competences, badges,
--                  mode histoire, table des types (efficacite)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. AVATARS : catalogue des avatars deblocables
--    Donnees statiques.
-- ---------------------------------------------------------------------
CREATE TABLE avatars (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(50) NOT NULL,
  image_url VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. USERS : les joueurs
--    active_avatar_id : l'avatar affiche. NULL = avatar par defaut.
--    country : code ISO 3166-1 alpha-2 (FR, JP, US...). Le front
--              affiche le drapeau correspondant. Pas de table : les
--              codes pays sont universels et immuables.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  email            VARCHAR(255) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  display_name     VARCHAR(50)  NOT NULL,
  country          CHAR(2)      NULL,
  level            SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  xp               INT UNSIGNED NOT NULL DEFAULT 0,
  active_avatar_id INT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_us_avatar FOREIGN KEY (active_avatar_id) REFERENCES avatars(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. USER_AVATARS : quels avatars un joueur a debloque
--    Pas de limite en base. Le "4 max" du wireframe est un choix
--    d'affichage du front.
-- ---------------------------------------------------------------------
CREATE TABLE user_avatars (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  avatar_id   INT NOT NULL,
  unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ua_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_ua_avatar FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ua (user_id, avatar_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. STONES : catalogue des pierres d'evolution (une par type Pokemon)
--    17 lignes (types Gen 1-2).
-- ---------------------------------------------------------------------
CREATE TABLE stones (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(50) NOT NULL,
  pokemon_type VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. POKEMON : catalogue des especes (Gen 1-2, ~251 lignes)
--    Donnees statiques, jamais modifiees par un joueur.
-- ---------------------------------------------------------------------
CREATE TABLE pokemon (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(50) NOT NULL,
  evolution_line_id INT NOT NULL,
  evolution_stage   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  evolves_into_id   INT NULL,
  stone_id          INT NULL,
  stone_cost        SMALLINT UNSIGNED NULL,
  type_primary      VARCHAR(20) NOT NULL,
  type_secondary    VARCHAR(20) NULL,
  base_atk          SMALLINT UNSIGNED NOT NULL,
  base_hp           SMALLINT UNSIGNED NOT NULL,
  base_def          SMALLINT UNSIGNED NOT NULL,
  base_speed        SMALLINT UNSIGNED NOT NULL,
  generation        TINYINT UNSIGNED NOT NULL,
  CONSTRAINT fk_pk_evolves FOREIGN KEY (evolves_into_id) REFERENCES pokemon(id),
  CONSTRAINT fk_pk_stone   FOREIGN KEY (stone_id)        REFERENCES stones(id),
  CONSTRAINT chk_pk_stage  CHECK (evolution_stage BETWEEN 0 AND 2),
  INDEX idx_pk_line (evolution_line_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. POKEMON_INSTANCES : les pokemon reellement possedes
--    Pas de stats calculees stockees : elles sont recalculees a la
--    volee par le service (voir R7). Stocker une stat calculee, c'est
--    devoir la recalculer a chaque equipement / etoile / niveau /
--    evolution, et avoir des donnees fausses le jour ou on en oublie un.
-- ---------------------------------------------------------------------
CREATE TABLE pokemon_instances (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  pokemon_id    INT NOT NULL,
  stars         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  star_progress SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_shiny      BOOLEAN NOT NULL DEFAULT FALSE,
  level         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  xp            INT UNSIGNED NOT NULL DEFAULT 0,
  obtained_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pi_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_pokemon FOREIGN KEY (pokemon_id) REFERENCES pokemon(id),
  CONSTRAINT chk_pi_stars  CHECK (stars BETWEEN 1 AND 5),
  INDEX idx_pi_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. TEAM_SLOTS : l'equipe unique de 6 pokemon
--    slot_position 1-6 = ordre d'attaque (gauche vers droite)
-- ---------------------------------------------------------------------
CREATE TABLE team_slots (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  slot_position       TINYINT UNSIGNED NOT NULL,
  pokemon_instance_id INT NOT NULL,
  CONSTRAINT fk_ts_user     FOREIGN KEY (user_id)             REFERENCES users(id)             ON DELETE CASCADE,
  CONSTRAINT fk_ts_instance FOREIGN KEY (pokemon_instance_id) REFERENCES pokemon_instances(id) ON DELETE CASCADE,
  CONSTRAINT chk_ts_pos     CHECK (slot_position BETWEEN 1 AND 6),
  UNIQUE KEY uq_ts_slot     (user_id, slot_position),
  UNIQUE KEY uq_ts_instance (user_id, pokemon_instance_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. ITEM_TEMPLATES : catalogue des items
--    category = le slot type (att/def/speed/spe)
--    mode     = le comportement (NULL pour att et speed)
--    rarity   = determine boost_value
-- ---------------------------------------------------------------------
CREATE TABLE item_templates (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  category    ENUM('att','def','speed','spe') NOT NULL,
  mode        ENUM('hp','taunt','crit','anticrit',
                   'heal_left','heal_right','heal_random',
                   'heal_lowest','heal_adjacent') NULL,
  rarity      ENUM('common','rare','ultra_rare','legendary','mythic') NOT NULL,
  boost_value SMALLINT UNSIGNED NOT NULL,
  INDEX idx_it_cat_rarity (category, rarity)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. ITEM_INSTANCES : les items possedes
--    pokemon_instance_id NULL = item en reserve (non equipe)
--    NULL != NULL en MySQL : la contrainte UNIQUE ne s'applique donc
--    pas aux items en reserve. Un joueur peut en avoir 500 de la meme
--    categorie sans conflit. C'est voulu.
-- ---------------------------------------------------------------------
CREATE TABLE item_instances (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  item_template_id    INT NOT NULL,
  category            ENUM('att','def','speed','spe') NOT NULL,
  pokemon_instance_id INT NULL,
  item_level          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  obtained_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ii_user     FOREIGN KEY (user_id)             REFERENCES users(id)             ON DELETE CASCADE,
  CONSTRAINT fk_ii_template FOREIGN KEY (item_template_id)    REFERENCES item_templates(id),
  CONSTRAINT fk_ii_pokemon  FOREIGN KEY (pokemon_instance_id) REFERENCES pokemon_instances(id) ON DELETE SET NULL,
  UNIQUE KEY uq_ii_equip    (pokemon_instance_id, category),
  INDEX idx_ii_user (user_id),
  INDEX idx_ii_reserve (user_id, pokemon_instance_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. USER_FRAGMENTS : le pot de fragments, PAR LIGNE EVOLUTIVE
--     Salameche / Reptincel / Dracaufeu partagent le meme pot.
-- ---------------------------------------------------------------------
CREATE TABLE user_fragments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  evolution_line_id INT NOT NULL,
  quantity          INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_uf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_uf (user_id, evolution_line_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. USER_STONES : les pierres possedees
-- ---------------------------------------------------------------------
CREATE TABLE user_stones (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  user_id  INT NOT NULL,
  stone_id INT NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_us_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_us_stone FOREIGN KEY (stone_id) REFERENCES stones(id),
  UNIQUE KEY uq_us (user_id, stone_id)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLES D'EQUILIBRAGE
-- Tu ajustes le jeu avec des UPDATE SQL, jamais en modifiant du JS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 12. STAR_COSTS : bareme du cout des etoiles
-- ---------------------------------------------------------------------
CREATE TABLE star_costs (
  star_level    TINYINT UNSIGNED PRIMARY KEY,
  fragment_cost SMALLINT UNSIGNED NOT NULL,
  CONSTRAINT chk_sc_level CHECK (star_level BETWEEN 1 AND 5)
) ENGINE=InnoDB;

INSERT INTO star_costs (star_level, fragment_cost) VALUES
  (1, 25), (2, 50), (3, 100), (4, 250), (5, 500);

-- ---------------------------------------------------------------------
-- 13. LEVEL_COSTS : bareme XP des pokemon
--     xp_required = xp cumule pour ATTEINDRE ce niveau.
--     Courbe volontairement exponentielle sur le COUT.
--     Les stats, elles, montent lineairement (voir R7).
--     Exemple de remplissage ci-dessous, a ajuster.
-- ---------------------------------------------------------------------
CREATE TABLE level_costs (
  level       SMALLINT UNSIGNED PRIMARY KEY,
  xp_required INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

INSERT INTO level_costs (level, xp_required) VALUES
  (1, 0), (2, 100), (3, 250), (4, 475), (5, 810),
  (6, 1315), (7, 2070), (8, 3200), (9, 4900), (10, 7450);
-- ... a completer jusqu'au niveau max souhaite.

-- ---------------------------------------------------------------------
-- 14. GAME_SETTINGS : constantes d'equilibrage (cle / valeur)
--     Evite de semer des nombres magiques dans le code.
--     value en DECIMAL pour accepter les coefficients (0.10, 0.02).
-- ---------------------------------------------------------------------
CREATE TABLE game_settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value DECIMAL(10,4) NOT NULL,
  description   VARCHAR(255) NULL
) ENGINE=InnoDB;

INSERT INTO game_settings (setting_key, setting_value, description) VALUES
  ('shiny_fragment_cost', 1000,   'Fragments requis pour rendre un pokemon shiny. Cosmetique pur.'),
  ('star_stat_coeff',     0.1000, 'Gain de stat par etoile. Formule : 1 + coeff * (stars - 1)'),
  ('level_stat_coeff',    0.0200, 'Gain de stat par niveau. Formule : 1 + coeff * (level - 1)'),
  ('team_size',           6,      'Nombre de slots dans une equipe.'),
  ('equip_slots',         4,      'Nombre de slots d''equipement par pokemon.'),
  ('max_stars',           5,      'Niveau d''etoile maximum.');

-- =====================================================================
-- REGLES DE GESTION NON EXPRIMABLES EN SQL
-- A implementer cote service Node.js, chacune DANS UNE TRANSACTION.
-- Sans transaction, un joueur peut perdre ses fragments sans gagner
-- son etoile. C'est le genre de bug qui fait fuir les joueurs.
-- =====================================================================
--
-- R1. VALEUR D'UN DOUBLON
--     Sacrifier un doublon rapporte (evolution_stage + 1) fragments
--     dans le pot de sa evolution_line_id.
--     Salameche (stage 0) = 1 / Reptincel (1) = 2 / Dracaufeu (2) = 3
--     Exemple : 1 Salameche + 2 Dracaufeu = 1 + (3*2) = 7 fragments
--
-- R2. MONTEE D'ETOILE (sequentielle)
--     Cout lu dans star_costs pour l'etoile visee.
--     star_progress se remplit jusqu'au cout, puis stars += 1 et
--     star_progress repart a 0.
--     Impossible de viser l'etoile 3 avant d'avoir termine la 2.
--
-- R3. EVOLUTION D'ESPECE
--     Consomme pokemon.stone_cost pierres du type pokemon.stone_id.
--     L'instance change de pokemon_id vers pokemon.evolves_into_id.
--     CONSERVES : stars, star_progress, level, xp, is_shiny, items equipes.
--     PAS CONSOMMES : les fragments (ils servent aux etoiles).
--
-- R4. SHINY
--     Cout fixe : game_settings.shiny_fragment_cost (1000).
--     Identique pour toutes les especes : la rarete du drop suffit a
--     rendre la tache difficile.
--     Purement cosmetique, aucun bonus de stat.
--
-- R5. EQUIPEMENT
--     Equiper    : UPDATE item_instances SET pokemon_instance_id = ?
--     Desequiper : UPDATE item_instances SET pokemon_instance_id = NULL
--     Aucun deplacement entre tables : aucun risque de dupliquer ou
--     perdre un item. uq_ii_equip garantit 1 seul item par categorie.
--
-- R6. COMBAT
--     Format : 6 vs 6, alignes de gauche a droite.
--     Initiative entre joueurs : somme des vitesses d'equipe.
--     Ordre d'action interne : slot_position 1 -> 6.
--       (la vitesse individuelle ne joue AUCUN role ici)
--     Ciblage : random parmi les taunt s'il y en a, sinon random
--       parmi tous les ennemis vivants.
--     Heal : le mode de l'item determine la cible. Montant = attaque
--       du pokemon convertie en PV.
--     Les roles viennent des ITEMS, pas de la position.
--     CALCUL EXCLUSIVEMENT SERVEUR. Jamais cote client.
--
-- R7. CALCUL DES STATS (a la volee, jamais stocke)
--
--     stat = base
--            * (1 + star_stat_coeff  * (stars - 1))
--            * (1 + level_stat_coeff * (level - 1))
--            + SOMME(boosts des items equipes)
--
--     Applique a atk, hp, def, speed.
--     Exemple : Dracaufeu base_atk 84
--       - etoile 1, niveau 1  -> 84
--       - etoile 3, niveau 20 -> 84 * 1.20 * 1.38 = 139
--       - etoile 5, niveau 50 -> 84 * 1.40 * 1.98 = 233
--       - etoile 5, niveau 50 + 4 items legendaires -> ~333
--
--     Les coefficients vivent dans game_settings : on reequilibre
--     sans toucher au code.
--
-- R8. AVATARS
--     users.active_avatar_id doit exister dans user_avatars pour ce
--     joueur. Non contraignable en SQL (contrainte inter-tables) :
--     a verifier dans le service avant chaque UPDATE.

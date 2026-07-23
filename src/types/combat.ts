// =====================================================================
// types/combat.ts — Contrat du log de combat (v1, 19/07/2026)
// Référence : COMBAT_SPEC.md. Le moteur produit ce log, le front le
// rejoue. Log AUTO-PORTEUR : chaque événement porte les résultats
// (VIE avant/après), le front ne calcule jamais rien.
// =====================================================================

/** Identifiant unique d'un pokémon DANS CE COMBAT (ex. "a3", "b5").
 *  Équipe + slot_position. Jamais un pokemon_instance_id : le log doit
 *  rester lisible sans requête en base, et ne pas exposer les ids
 *  d'instance de l'adversaire. */
export type CombatUid = string;

export type TeamKey = "a" | "b";
export type ArenaId = "stadium"; // union à étendre avec les contextes (quêtes, PVP)

/** Le rôle = le mode de l'item spe équipé, "attacker" si slot vide.
 *  Donnée technique en anglais ; le libellé français est un
 *  dictionnaire côté front. */
export type CombatRole =
	| "attacker"
	| "taunt"
	| "crit"
	| "anticrit"
	| "heal_left"
	| "heal_right"
	| "heal_random"
	| "heal_lowest"
	| "heal_adjacent"
	| "heal_all"
	| "atk_adjacent";

// ---------------------------------------------------------------------
// setup — événement 0, toujours. Tout ce qu'il faut pour dessiner le
// terrain sans refaire R7.
// ---------------------------------------------------------------------
export type Rarity = "common" | "rare" | "ultra_rare" | "legendary" | "mythic";

export interface SetupItem {
	category: "att" | "def" | "speed" | "spe";
	name: string; // nom EN du catalogue → dictionnaire FR côté front
	boost: number; // boost_value de l'item (l'effet chiffré, hover front)
	rarity: Rarity;
}

export interface MemberSetup {
	uid: CombatUid;
	slot_position: number; // 1-6
	pokemon_id: number; // sprite + nom (catalogue)
	is_shiny: boolean;
	type_primary: string; // fond couleur de la carte
	type_secondary: string | null;
	role: CombatRole;
	attaque: number; // ATT + SPE — statique tout le combat
	vie_max: number; // HP + DEF + SPD — valeur de départ ET cap de soin
	stars: number; // 1-5
	items: SetupItem[]; // 0-4, ordonnés par catégorie att/def/speed/spe
}

export interface TeamProfile {
	display_name: string;
	avatar_url: string | null; // file_path relatif ("uploads/..."), null = avatar par defaut ; le front construit l'URL (photoUrl)
}

export interface TeamSetup {
	user_id: number;
	total_speed: number; // initiative (hover profil)
	members: MemberSetup[]; // ordonnés par slot_position
}

export interface SetupEvent {
	seq: 0;
	type: "setup";
	teams: { a: TeamSetup; b: TeamSetup };
	arena: ArenaId;
	profiles: { a: TeamProfile; b: TeamProfile };
	first: TeamKey; // qui commence (seule source lue par le front)
}

// ---------------------------------------------------------------------
// coinflip — émis UNIQUEMENT si égalité de total_speed. Sert à
// l'animation et au debug ; l'ordre reste porté par setup.first.
// ---------------------------------------------------------------------

export interface CoinflipEvent {
	seq: number;
	type: "coinflip";
	winner: TeamKey;
}

// ---------------------------------------------------------------------
// attack — l'échange complet (modèle Battlegrounds, §5).
// La riposte n'est PAS un événement : c'est une propriété de l'échange.
// Le fallback d'un healer sans cible émet un attack normal.
// ---------------------------------------------------------------------

/** Dégâts appliqués à un pokémon. vie_apres peut être négatif
 *  (overkill loggé) : le front affiche max(0, vie_apres). */
export interface Hit {
	uid: CombatUid;
	amount: number;
	vie_avant: number;
	vie_apres: number;
}

export interface AttackEvent {
	seq: number;
	type: "attack";
	actor: CombatUid;
	target: CombatUid; // cible principale (la seule qui riposte)
	crit: boolean; // crit sur la frappe active uniquement — jamais en riposte
	hits: Hit[]; // 1 élément, ou 2-3 pour atk_adjacent (cible en premier)
	riposte: Hit | null; // nullable par prudence pour des modes futurs
}

// ---------------------------------------------------------------------
// heal — l'action convertie (§6.4). Ne déclenche jamais de riposte
// ni de mort : structure séparée de Hit exprès.
// ---------------------------------------------------------------------

/** Soin appliqué. amount = APRÈS cap (le soin réellement reçu),
 *  vie_apres jamais > vie_max, garanti par le moteur. */
export interface HealApplied {
	uid: CombatUid;
	amount: number;
	vie_avant: number;
	vie_apres: number;
}

export interface HealEvent {
	seq: number;
	type: "heal";
	actor: CombatUid;
	targets: HealApplied[]; // 1 élément, ou 2 pour heal_adjacent (1 sur un bord)
}

// ---------------------------------------------------------------------
// death — un événement PAR mort, émis après l'échange qui l'a causée.
// Ordre en cas de morts multiples : cible principale, puis voisins
// dans l'ordre des hits, puis l'attaquant s'il meurt de la riposte.
// ---------------------------------------------------------------------

export interface DeathEvent {
	seq: number;
	type: "death";
	uid: CombatUid;
}

// ---------------------------------------------------------------------
// end — toujours le dernier. "draw" = max_actions atteint (§10),
// seul chemin vers le nul ; le warning d'équilibrage est un log
// serveur, pas une donnée du contrat.
// ---------------------------------------------------------------------

export interface EndEvent {
	seq: number;
	type: "end";
	result: TeamKey | "draw";
	actions: number; // nombre d'actions jouées
}

// ---------------------------------------------------------------------
// Le log complet
// ---------------------------------------------------------------------

export type CombatEvent =
	| SetupEvent
	| CoinflipEvent
	| AttackEvent
	| HealEvent
	| DeathEvent
	| EndEvent;

export interface CombatLog {
	version: 2;
	events: CombatEvent[];
}
// ---------------------------------------------------------------------
// BAC A SABLE (theorycrafting) — POST /api/combat/sandbox
// Le joueur compose LES DEUX equipes librement : n'importe quelle
// espece, n'importe quel niveau/etoiles, n'importe quel item du
// catalogue. Rien n'est lu ni ecrit dans pokemon_instances : ces
// equipes sont ephemeres, elles n'existent que le temps du combat.
// ---------------------------------------------------------------------

/** Un pokemon compose a la main. Les stats de base viennent du
 *  catalogue (pokemon_id) ; le reste est choisi par le joueur.
 *  item_template_ids : 0 a 4 ids de item_templates, UN PAR CATEGORIE
 *  au maximum (le back refuse les doublons de categorie — le moteur
 *  sommerait les boosts, ce qui n'existe pas en jeu reel). */
export interface SandboxMember {
	pokemon_id: number;
	level: number;
	stars: number;
	is_shiny: boolean;
	item_template_ids: number[];
}

/** Les stats calculees d'un membre, telles que le moteur les utilisera.
 *  Sert la preview du bac a sable : ce que le joueur voit ici est
 *  EXACTEMENT ce qui entrera en combat (meme chaine R7 + fusion). */
export interface SandboxMemberPreview {
	slot_position: number;
	pokemon_id: number;
	role: CombatRole;
	attaque: number; // ATT + SPE
	vie_max: number; // HP + DEF + SPD
}

/** Une equipe composee : 1 a 6 membres, dans l'ordre des slots.
 *  name : libelle libre du theorycrafting ("Compo agressive"). */
export interface SandboxTeam {
	name: string;
	members: SandboxMember[];
}

/** Les stats d'une equipe composee. */
export interface SandboxTeamPreview {
	total_speed: number; // initiative (COMBAT_SPEC 4.1)
	total_attaque: number;
	total_vie: number;
	members: SandboxMemberPreview[];
}

/** Le payload de POST /api/combat/sandbox. */
export interface SandboxPayload {
	teams: { a: SandboxTeam; b: SandboxTeam };
}

/** La reponse de POST /api/sandbox/preview.
 *  Les deux equipes, pour comparer d'un coup d'oeil. */
export interface SandboxPreview {
	teams: { a: SandboxTeamPreview; b: SandboxTeamPreview };
}

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
	version: 1; // incrémenter si le format change : les replays archivés restent lisibles
	events: CombatEvent[];
}

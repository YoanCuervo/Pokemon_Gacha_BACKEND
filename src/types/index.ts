/*noms de champs correspondent EXACTEMENT aux colonnes MySQL. Si on renomme une colonne, on renomme ici. */

export interface Pokemon {
	id: number;
	name: string;
	evolution_line_id: number;
	evolution_stage: number;
	evolves_into_id: number | null;
	stone_id: number | null;
	stone_cost: number | null;
	type_primary: string;
	type_secondary: string | null;
	base_atk: number;
	base_hp: number;
	base_def: number;
	base_speed: number;
	generation: number;
}

export interface ItemTemplate {
	id: number;
	name: string;
	category: ItemCategory;
	mode: ItemMode | null;
	rarity: ItemRarity;
	boost_value: number;
}

// Les ENUM SQL deviennent des union types.
export type ItemCategory = "att" | "def" | "speed" | "spe";

export type ItemMode =
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

export type ItemRarity =
	| "common"
	| "rare"
	| "ultra_rare"
	| "legendary"
	| "mythic";

// ---------------------------------------------------------------
// POSSESSIONS
// ---------------------------------------------------------------

export interface PokemonInstance {
	id: number;
	user_id: number;
	pokemon_id: number;
	stars: number;
	star_progress: number;
	is_shiny: boolean;
	level: number;
	xp: number;
	obtained_at: Date;
}

export interface TeamSlot {
	id: number;
	user_id: number;
	slot_position: number;
	pokemon_instance_id: number;
}

// ---------------------------------------------------------------
// TYPES DE REPONSE API
// Ce que le back renvoie au front. Ce ne sont PAS des tables :
// ce sont des vues assemblees a partir de plusieurs.
// ---------------------------------------------------------------

/* Une ligne brute de la requete a 4 jointures.
Rappel : la requete renvoie jusqu'a 24 lignes (6 pokemon x 4 items), pas 6. Le service les regroupe en TeamMember[].*/
export interface TeamSlotRow {
	slot_position: number;
	instance_id: number;
	pokemon_id: number;
	name: string;
	type_primary: string;
	type_secondary: string | null;
	base_atk: number;
	base_hp: number;
	base_def: number;
	base_speed: number;
	stars: number;
	level: number;
	is_shiny: boolean;
	item_id: number | null;
	item_name: string | null;
	item_category: ItemCategory | null;
	item_required_type: string | null;
	item_mode: ItemMode | null;
	item_boost: number | null;
}

/** Un item equipe, tel que renvoye au front. */
export interface EquippedItem {
	id: number;
	name: string;
	category: ItemCategory;
	required_type: string | null;
	mode: ItemMode | null;
	boost_value: number;
}

/** Un pokemon de l'equipe, assemble et pret a etre afficher. */
export interface TeamMember {
	slot_position: number;
	instance_id: number;
	pokemon_id: number;
	name: string;
	type_primary: string;
	type_secondary: string | null;
	stars: number;
	level: number;
	is_shiny: boolean; // ici on a caste : le front veut un vrai booleen
	items: EquippedItem[];
	// Stats calculees a la volee (regle R7), jamais stockees en base
	stats: ComputedStats;
}

export interface ComputedStats {
	atk: number;
	hp: number;
	def: number;
	speed: number;
}

/** La reponse de GET /api/team */
export interface TeamResponse {
	members: TeamMember[];
	total_speed: number; // la somme qui decide de l'initiative (regle R6)
}

// ---------------------------------------------------------------
// PAYLOADS (ce que le front envoie)
// ---------------------------------------------------------------

/** POST /api/team */
export interface AddToTeamPayload {
	pokemon_instance_id: number;
	slot_position: number;
}

/** PATCH /api/team/reorder — l'ordre complet, 6 instance_id max */
export interface ReorderTeamPayload {
	order: number[];
}

export interface BoxInstance {
	instance_id: number;
	pokemon_id: number;
	name: string;
	type_primary: string;
	type_secondary: string | null;
	level: number;
	stars: number;
	is_shiny: boolean;
}

// ---------------------------------------------------------------
// FICHE POKEMON (inventaire) — GET /api/pokemon/:instanceId
// Lecture pure de possession : identite + etat + 4 slots equipes.
// Pas de stats calculées (R7 vit dans la fiche de combat mais jamais ici).
// ---------------------------------------------------------------

/** Ligne plate de la requete fiche : l'instance 'x' un item équipe (LEFT JOIN).
 *  1 a 4 lignes (0 item -> 1 ligne avec les item_* a NULL). */
export interface InstanceRow {
	instance_id: number;
	pokemon_id: number;
	name: string;
	type_primary: string;
	type_secondary: string | null;
	level: number;
	stars: number;
	is_shiny: boolean;
	item_id: number | null;
	item_name: string | null;
	item_category: ItemCategory | null;
	item_required_type: string | null;
	item_mode: ItemMode | null;
	item_boost: number | null;
}

/** Un slot d'equipement : sa categorie + l'item dedans (null si vide).
 *  Le back garantit TOUJOURS les 4 slots dans l'ordre att/def/speed/spe. */
export interface EquipSlot {
	category: ItemCategory;
	item: EquippedItem | null;
}

/** L'identite + l'etat d'une instance (sans items, sans stats). */
export interface InstanceIdentity {
	instance_id: number;
	pokemon_id: number;
	name: string;
	type_primary: string;
	type_secondary: string | null;
	level: number;
	stars: number;
	is_shiny: boolean;
}

/** La reponse de GET /api/pokemon/:instanceId */
export interface InstanceDetail {
	instance: InstanceIdentity;
	equipped: EquipSlot[]; // toujours 4, ordre att/def/speed/spe
}

// ---------------------------------------------------------------
// RESERVE D'ITEMS (inventaire) — GET /api/items/reserve
// Les items possedes NON equipes (pokemon_instance_id IS NULL).
// Alimente la grille de droite du wireframe equipement ; le front
// filtre en memoire (categorie via le slot, + type + rarete).
// ---------------------------------------------------------------

/** Un item en reserve, tel que renvoye au front.
 *  id       = item_instances.id (l'instance qu'on equipera)
 *  category = source de verite pour le filtre "slot" cote front
 *  rarity   = pour le FILTER by rarity
 *  required_type = pour le FILTER by type (et le grisage si non-match) */
export interface ReserveItem {
	id: number;
	template_id: number;
	name: string;
	category: ItemCategory;
	required_type: string | null;
	mode: ItemMode | null;
	rarity: ItemRarity;
	boost_value: number;
	item_level: number;
}

/** La reponse de GET /api/items/reserve */
export interface ReserveResponse {
	items: ReserveItem[];
}

/*noms de champs correspondent EXACTEMENT aux colonnes MySQL. Si tu renommes une colonne, tu renommes ici. */

// ---------------------------------------------------------------
// CATALOGUES (donnees statiques)
// ---------------------------------------------------------------

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

/** Un pokemon de l'equipe, assemble et pret a afficher. */
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

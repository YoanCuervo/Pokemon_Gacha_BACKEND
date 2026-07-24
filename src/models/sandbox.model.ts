import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";

/**
 * MODEL — SQL seul, aucune regle de jeu.
 *
 * BAC A SABLE : lecture des deux CATALOGUES (especes, items).
 * Aucune ecriture, aucune lecture de pokemon_instances : les equipes
 * du bac a sable sont ephemeres, elles n'appartiennent a personne.
 *
 * Les ids viennent du client (donnee hostile) : ces requetes servent
 * aussi de VALIDATION — un id absent du resultat est un id invalide,
 * le service compare les tailles pour le detecter.
 */

/** Les stats de base d'une espece, telles que le combat les attend. */
export interface SpeciesRow extends RowDataPacket {
	pokemon_id: number;
	type_primary: string;
	type_secondary: string | null;
	base_atk: number;
	base_spe: number;
	base_hp: number;
	base_def: number;
	base_spd: number;
	base_speed: number;
}

/** Les especes demandees, indexees par id.
 *  Un id absent de la Map = espece inexistante (le service refuse). */
export async function findSpeciesByIds(
	pokemonIds: number[],
): Promise<Map<number, SpeciesRow>> {
	if (pokemonIds.length === 0) return new Map();

	// Placeholders generes depuis la LONGUEUR, jamais depuis le contenu :
	// les valeurs restent parametrees.
	const placeholders = pokemonIds.map(() => "?").join(", ");

	const [rows] = await pool.query<SpeciesRow[]>(
		`SELECT
			p.id AS pokemon_id,
			p.type_primary,
			p.type_secondary,
			p.base_atk,
			p.base_spe,
			p.base_hp,
			p.base_def,
			p.base_spd,
			p.base_speed
		FROM pokemon p
		WHERE p.id IN (${placeholders})`,
		pokemonIds,
	);

	const map = new Map<number, SpeciesRow>();
	for (const row of rows) map.set(row.pokemon_id, row);
	return map;
}

/** Un template d'item, tel que le combat l'attend.
 *  La rarete, le boost et le mode viennent du TEMPLATE : le client ne
 *  choisit qu'un id, il ne peut pas mentir sur la puissance d'un item.
 *  is_unique : un item marque unique ne peut equiper qu'UN pokemon de
 *  la lineup entiere, meme si le joueur en possede plusieurs. */
export interface ItemTemplateRow extends RowDataPacket {
	template_id: number;
	name: string;
	category: "att" | "def" | "speed" | "spe";
	required_type: string | null;
	mode: string | null;
	rarity: "common" | "rare" | "ultra_rare" | "legendary" | "mythic";
	boost_value: number;
	is_unique: number | boolean; // TINYINT ou boolean selon le driver
}

/** Les templates demandes, indexes par id.
 *  Un id absent de la Map = item inexistant (le service refuse). */
export async function findItemTemplatesByIds(
	templateIds: number[],
): Promise<Map<number, ItemTemplateRow>> {
	if (templateIds.length === 0) return new Map();

	const placeholders = templateIds.map(() => "?").join(", ");

	const [rows] = await pool.query<ItemTemplateRow[]>(
		`SELECT
			it.id AS template_id,
			it.name,
			it.category,
			it.required_type,
			it.mode,
			it.rarity,
			it.boost_value,
			it.is_unique
		FROM item_templates it
		WHERE it.id IN (${placeholders})`,
		templateIds,
	);

	const map = new Map<number, ItemTemplateRow>();
	for (const row of rows) map.set(row.template_id, row);
	return map;
}

/** Le catalogue COMPLET des especes, pour alimenter le selecteur du
 *  front (251 lignes). Trie par id (ordre Pokedex). */
export interface SpeciesCatalogRow extends RowDataPacket {
	pokemon_id: number;
	name: string;
	type_primary: string;
	type_secondary: string | null;
}

export async function findAllSpecies(): Promise<SpeciesCatalogRow[]> {
	const [rows] = await pool.query<SpeciesCatalogRow[]>(
		`SELECT
			p.id AS pokemon_id,
			p.name,
			p.type_primary,
			p.type_secondary
		FROM pokemon p
		ORDER BY p.id`,
	);
	return rows;
}

/** Le catalogue COMPLET des items equipables, pour le selecteur du
 *  front. Trie par categorie puis rarete puis nom. */
export async function findAllItemTemplates(): Promise<ItemTemplateRow[]> {
	const [rows] = await pool.query<ItemTemplateRow[]>(
		`SELECT
			it.id AS template_id,
			it.name,
			it.category,
			it.required_type,
			it.mode,
			it.rarity,
			it.boost_value,
			it.is_unique
		FROM item_templates it
		ORDER BY it.category, it.rarity, it.name`,
	);
	return rows;
}

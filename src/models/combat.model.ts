import { pool } from "../config/db";

/**
 * MODEL — SQL seul, aucune regle de jeu.
 *
 * Requete DEDIEE au combat, separee de team.model exprès : le combat a
 * besoin des 6 stats de base (v3.1 : + spe, spd), de la RARETE de
 * l'item spe (crit/anticrit, COMBAT_SPEC 6.3) et, depuis le contrat
 * setup enrichi (v2), du NOM des items (slots du CardPreview).
 * Des besoins differents = des requetes differentes.
 */

/** Une ligne plate : un membre d'equipe x un item equipe (LEFT JOIN).
 *  Jusqu'a 24 lignes pour une equipe pleine (6 pokemon x 4 items).
 *  Exporte ici et non dans types/index.ts : ce format n'existe que
 *  entre ce model et le builder de combat. */
export interface CombatTeamRow {
	slot_position: number;
	instance_id: number;
	pokemon_id: number;
	is_shiny: boolean;
	type_primary: string;
	type_secondary: string | null;
	stars: number;
	level: number;
	base_atk: number;
	base_spe: number;
	base_hp: number;
	base_def: number;
	base_spd: number;
	base_speed: number;
	// Item equipe (NULL si le pokemon n'en a pas sur cette ligne)
	item_name: string | null;
	item_category: "att" | "def" | "speed" | "spe" | null;
	item_required_type: string | null;
	item_mode: string | null; // renseigne uniquement pour category = 'spe'
	item_rarity: "common" | "rare" | "ultra_rare" | "legendary" | "mythic" | null;
	item_boost: number | null;
}

/**
 * L'equipe d'un joueur, prete pour le moteur.
 * Meme forme plate que findTeamByUserId : le builder recollera.
 */
export async function findCombatTeamByUserId(
	userId: number,
): Promise<CombatTeamRow[]> {
	const [rows] = await pool.query(
		`SELECT
			ts.slot_position,
			pi.id AS instance_id,
			p.id  AS pokemon_id,
			pi.is_shiny,
			p.type_primary,
			p.type_secondary,
			pi.stars,
			pi.level,
			p.base_atk,
			p.base_spe,
			p.base_hp,
			p.base_def,
			p.base_spd,
			p.base_speed,
			it.name          AS item_name,
			it.category      AS item_category,
			it.required_type AS item_required_type,
			it.mode          AS item_mode,
			it.rarity        AS item_rarity,
			it.boost_value   AS item_boost
		FROM team_slots ts
		JOIN pokemon_instances pi ON pi.id = ts.pokemon_instance_id
		JOIN pokemon p            ON p.id  = pi.pokemon_id
		LEFT JOIN item_instances ii ON ii.pokemon_instance_id = pi.id
		LEFT JOIN item_templates it ON it.id = ii.item_template_id
		WHERE ts.user_id = ?
		ORDER BY ts.slot_position ASC`,
		[userId],
	);

	return rows as CombatTeamRow[];
}

/** Profil d'un joueur pour le setup du combat (contrat v2).
 *  avatar_path = chemin DISQUE de la photo active (user_photos.file_path),
 *  NULL si aucune photo active -> avatar par defaut cote front.
 *  La transformation en URL servable est une regle de service. */
export interface CombatProfileRow {
	display_name: string;
	avatar_path: string | null;
}

/** Le profil d'un joueur, ou null si le user n'existe pas. */
export async function findCombatProfileByUserId(
	userId: number,
): Promise<CombatProfileRow | null> {
	const [rows] = await pool.query(
		`SELECT
			u.display_name,
			up.file_path AS avatar_path
		FROM users u
		LEFT JOIN user_photos up ON up.id = u.active_avatar_id
		WHERE u.id = ?`,
		[userId],
	);

	const list = rows as CombatProfileRow[];
	return list[0] ?? null;
}

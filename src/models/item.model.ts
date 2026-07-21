import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";
import type { ReserveItem } from "../types";

/**
 * MODEL — SQL seul, aucune regle de jeu.
 *
 * La reserve : les item_instances du joueur NON equipees
 * (pokemon_instance_id IS NULL). Toutes les colonnes item viennent du
 * TEMPLATE (meme source que combat.model), sauf id/item_level qui sont
 * propres a l'instance. L'index idx_ii_reserve (user_id,
 * pokemon_instance_id) couvre ce WHERE.
 */

interface ReserveItemRow extends RowDataPacket, ReserveItem {}

export async function findReserveByUserId(
	userId: number,
): Promise<ReserveItem[]> {
	const [rows] = await pool.query<ReserveItemRow[]>(
		`SELECT
			ii.id            AS id,
			it.id            AS template_id,
			it.name          AS name,
			it.category      AS category,
			it.required_type AS required_type,
			it.mode          AS mode,
			it.rarity        AS rarity,
			it.boost_value   AS boost_value,
			ii.item_level    AS item_level
		FROM item_instances ii
		JOIN item_templates it ON it.id = ii.item_template_id
		WHERE ii.user_id = ?
			AND ii.pokemon_instance_id IS NULL
		ORDER BY it.category, it.rarity DESC, it.name`,
		[userId],
	);
	return rows;
}

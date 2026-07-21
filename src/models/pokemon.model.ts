import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";
import type { InstanceRow } from "../types";

/**
 * MODEL — SQL seul, aucune regle de jeu.
 *
 * Fiche d'une instance : identite de l'espece + etat de l'instance +
 * items equipes (LEFT JOIN, jusqu'a 4 lignes). AUCUNE stat de base :
 * l'inventaire ne calcule rien (R7 vit dans la fiche de combat).
 *
 * Le filtre sur user_id est porte par le SERVICE (regle de propriete),
 * pas ici : le model rend les lignes, le service decide si tu y as droit.
 * On join quand meme user_id dans le WHERE pour ne pas ramener une
 * instance d'un autre joueur (defense en profondeur, cote SQL).
 */

interface InstanceRowPacket extends RowDataPacket, InstanceRow {}

export async function findInstanceById(
	instanceId: number,
	userId: number,
): Promise<InstanceRow[]> {
	const [rows] = await pool.query<InstanceRowPacket[]>(
		`SELECT
			pi.id AS instance_id,
			pi.pokemon_id,
			p.name,
			p.type_primary,
			p.type_secondary,
			pi.level,
			pi.stars,
			pi.is_shiny,
			ii.id            AS item_id,
			it.name          AS item_name,
			it.category      AS item_category,
			it.required_type AS item_required_type,
			it.mode          AS item_mode,
			it.boost_value   AS item_boost
		FROM pokemon_instances pi
		JOIN pokemon p ON p.id = pi.pokemon_id
		LEFT JOIN item_instances ii ON ii.pokemon_instance_id = pi.id
		LEFT JOIN item_templates it ON it.id = ii.item_template_id
		WHERE pi.id = ? AND pi.user_id = ?`,
		[instanceId, userId],
	);
	return rows;
}

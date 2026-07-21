import type {
	PoolConnection,
	ResultSetHeader,
	RowDataPacket,
} from "mysql2/promise";
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

/** L'instance existe-t-elle et appartient-elle au user ?
 *  Renvoie true/false, sans charger la fiche. */
export async function instanceBelongsToUserTx(
	conn: PoolConnection,
	instanceId: number,
	userId: number,
): Promise<boolean> {
	const [rows] = await conn.query<RowDataPacket[]>(
		`SELECT 1 FROM pokemon_instances WHERE id = ? AND user_id = ? LIMIT 1`,
		[instanceId, userId],
	);
	return rows.length > 0;
}

/** Un item en RESERVE (non equipe) du user + sa categorie.
 *  null si l'item n'existe pas, n'est pas au user, ou est deja equipe.
 *  On lit la categorie de l'INSTANCE (denormalisee) : c'est le slot cible. */
export async function findReserveItemForEquip(
	conn: PoolConnection,
	itemInstanceId: number,
	userId: number,
): Promise<{ category: string } | null> {
	const [rows] = await conn.query<RowDataPacket[]>(
		`SELECT category
		FROM item_instances
		WHERE id = ? AND user_id = ? AND pokemon_instance_id IS NULL
		LIMIT 1`,
		[itemInstanceId, userId],
	);
	const first = rows[0];
	return first ? { category: first.category as string } : null;
}

/** Vide le slot (category) d'un pokemon : renvoie l'item occupant en
 *  reserve. No-op si le slot est deja vide. Retourne le nb de lignes
 *  touchees (0 ou 1). */
export async function clearSlot(
	conn: PoolConnection,
	instanceId: number,
	category: string,
): Promise<number> {
	const [res] = await conn.query<ResultSetHeader>(
		`UPDATE item_instances
		SET pokemon_instance_id = NULL
		WHERE pokemon_instance_id = ? AND category = ?`,
		[instanceId, category],
	);
	return res.affectedRows;
}

/** Equipe un item sur une instance (le slot est deja libre a ce stade). */
export async function attachItem(
	conn: PoolConnection,
	itemInstanceId: number,
	instanceId: number,
): Promise<void> {
	await conn.query(
		`UPDATE item_instances
		SET pokemon_instance_id = ?
		WHERE id = ?`,
		[instanceId, itemInstanceId],
	);
}

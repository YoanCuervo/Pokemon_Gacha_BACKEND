import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db";
import type { TeamSlotRow } from "../types";

/**
 * MODEL — cette couche ne connait QUE le SQL.
 
 * Elle ne sait pas qu'HTTP existe, elle ne connait aucune regle du jeu.
 * Elle prend des parametres, elle renvoie des lignes. C'est tout.
 * Regle absolue : jamais de concatenation dans une requete.
 *   `WHERE user_id = ${userId}`        -> injection SQL
 *   "WHERE user_id = ?", [userId]      -> mysql2 echappe la valeur
 */
/*
 * 4 jointures :
 *   team_slots -> pokemon_instances -> pokemon
 *              -> item_instances    -> item_templates
 *
 * Deux points a comprendre :
 * 1. Les LEFT JOIN sur les items sont OBLIGATOIRES. Un pokemon sans
 *    item existe. Avec un INNER JOIN il disparaitrait du resultat :
 *    ton equipe de 6 en afficherait 4.
 *
 * 2. Cette requete renvoie jusqu'a 24 lignes, pas 6. Chaque pokemon
 *    est duplique autant de fois qu'il a d'items (6 x 4). C'est le
 *    fonctionnement normal d'une jointure. Le regroupement en 6 objets
 *    se fait dans le service, pas ici.
 */
export async function findTeamByUserId(userId: number): Promise<TeamSlotRow[]> {
	const [rows] = await pool.query<RowDataPacket[]>(
		`SELECT
       ts.slot_position,
       pi.id            AS instance_id,
       pi.pokemon_id,
       pi.stars,
       pi.level,
       pi.is_shiny,
       p.name,
       p.type_primary,
       p.type_secondary,
       p.base_atk,
       p.base_spe,
       p.base_hp,
       p.base_def,
       p.base_spd,
       p.base_speed,
       ii.id            AS item_id,
       it.name          AS item_name,
       ii.category      AS item_category,
       it.required_type AS item_required_type,
       it.mode          AS item_mode,
       it.boost_value   AS item_boost,
       it.rarity        AS item_rarity
     FROM team_slots ts
       JOIN pokemon_instances pi ON pi.id = ts.pokemon_instance_id
       JOIN pokemon p            ON p.id  = pi.pokemon_id
       LEFT JOIN item_instances ii ON ii.pokemon_instance_id = pi.id
       LEFT JOIN item_templates it ON it.id = ii.item_template_id
     WHERE ts.user_id = ?
     ORDER BY ts.slot_position`,
		[userId],
	);

	return rows as TeamSlotRow[];
}

/**
 * Place un pokemon dans un slot
 *   uq_ts_slot     (user_id, slot_position)       -> slot deja pris
 *   uq_ts_instance (user_id, pokemon_instance_id) -> pokemon deja dans l'equipe
 */
export async function insertTeamSlot(
	userId: number,
	pokemonInstanceId: number,
	slotPosition: number,
): Promise<number> {
	const [result] = await pool.query<ResultSetHeader>(
		`INSERT INTO team_slots (user_id, slot_position, pokemon_instance_id)
     VALUES (?, ?, ?)`,
		[userId, slotPosition, pokemonInstanceId],
	);

	return result.insertId;
}

/*Remplace l'ordre complet de l'equipe.
 * Le front envoie le tableau final des instance_id — [12, 45, 3, 8, 21, 7].
 * On efface tout et on reecrit sans aucun etat intermediaire invalide.
 * TRANSACTION OBLIGATOIRE : entre le DELETE et les INSERT, l'equipe
 * n'existe plus. Si le process meurt la, le joueur perd son equipe.
 * La transaction garantit le tout-ou-rien.
 
 * Note : une transaction se fait sur UNE connexion, pas sur le pool.
 * Avec pool.query(), chaque requete peut partir sur une connexion
 * differente et le beginTransaction ne veut plus rien dire*/
export async function replaceTeamOrder(
	userId: number,
	order: number[],
): Promise<void> {
	const conn = await pool.getConnection();

	try {
		await conn.beginTransaction();

		await conn.query("DELETE FROM team_slots WHERE user_id = ?", [userId]);

		// slot_position part de 1, pas de 0 : l'index du tableau + 1.
		for (const [index, instanceId] of order.entries()) {
			await conn.query(
				`INSERT INTO team_slots (user_id, slot_position, pokemon_instance_id)
         VALUES (?, ?, ?)`,
				[userId, index + 1, instanceId],
			);
		}

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err; // on remonte : c'est au service de decider quoi en faire
	} finally {
		conn.release(); // TOUJOURS, meme si ca a plante
	}
}

/*Retire le pokemon d'un slot.
 Renvoie TRUE si une ligne est supprimée, FALSE si le slot etait deja vide. C'est ce qui permettra au controller de repondre 404 plutot que 200 sur un slot inexistant.*/
export async function deleteTeamSlot(
	userId: number,
	slotPosition: number,
): Promise<boolean> {
	const [result] = await pool.query<ResultSetHeader>(
		"DELETE FROM team_slots WHERE user_id = ? AND slot_position = ?",
		[userId, slotPosition],
	);

	return result.affectedRows > 0;
}

/*Verifie qu'une instance appartient bien au joueur.
 Sans ce controle, n'importe qui pourrait mettre le Dracaufeu d'un autre joueur dans son equipe : rien dans team_slots n'empeche d'y placer une instance qui ne t'appartient pas. La FK verifie que l'instance existe, pas a qui elle est. C'est le genre de trou qu'on ne voit pas tant qu'on teste avec un seul utilisateur. */
export async function instanceBelongsToUser(
	userId: number,
	pokemonInstanceId: number,
): Promise<boolean> {
	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT 1 FROM pokemon_instances WHERE id = ? AND user_id = ? LIMIT 1",
		[pokemonInstanceId, userId],
	);

	return rows.length > 0;
}

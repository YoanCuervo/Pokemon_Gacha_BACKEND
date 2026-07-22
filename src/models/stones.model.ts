import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";
import type { UserStone } from "../types";

/**
 * MODEL — SQL seul, aucune regle de jeu.
 *
 * Les pierres possedees par un joueur. Domaine a part (pas dans pokemon)
 * car les pierres ne sont pas liees a une instance : elles appartiennent
 * au joueur. Reutilisable pour le Sac a dos (inventaire general).
 *
 * On renvoie les lignes user_stones EXISTANTES, quantite comprise a 0
 * (une pierre tombee a zero reste une pierre connue du joueur ; c'est
 * coherent avec la regle "on ne supprime jamais la ligne a 0").
 * Le front decide de masquer les 0 ou non.
 */

interface UserStoneRowPacket extends RowDataPacket, UserStone {}

/** Toutes les pierres du joueur, avec leur quantite.
 *  Triees par type pour un ordre stable a l'affichage (le front
 *  remontera la pierre requise en premier). */
export async function findStonesByUserId(
	userId: number,
): Promise<UserStone[]> {
	const [rows] = await pool.query<UserStoneRowPacket[]>(
		`SELECT
			s.id           AS stone_id,
			s.name,
			s.pokemon_type AS type,
			us.quantity
		FROM user_stones us
		JOIN stones s ON s.id = us.stone_id
		WHERE us.user_id = ?
		ORDER BY s.pokemon_type`,
		[userId],
	);
	return rows;
}
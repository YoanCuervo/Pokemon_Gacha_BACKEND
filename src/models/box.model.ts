import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";
import type { BoxInstance } from "../types";

interface BoxInstanceRow extends RowDataPacket, BoxInstance {}

// Instances du joueur HORS equipe (anti-join sur team_slots)
export async function findBoxInstancesByUserId(
	userId: number,
): Promise<BoxInstance[]> {
	const [rows] = await pool.query<BoxInstanceRow[]>(
		`SELECT
			pi.id AS instance_id,
			pi.pokemon_id,
			p.name,
			p.type_primary,
			p.type_secondary,
			pi.level,
			pi.star_progress AS stars,
			pi.is_shiny
		FROM pokemon_instances pi
		JOIN pokemon p ON p.id = pi.pokemon_id
		LEFT JOIN team_slots ts ON ts.pokemon_instance_id = pi.id
		WHERE pi.user_id = ?
			AND ts.pokemon_instance_id IS NULL
		ORDER BY pi.id`,
		[userId],
	);
	return rows;
}

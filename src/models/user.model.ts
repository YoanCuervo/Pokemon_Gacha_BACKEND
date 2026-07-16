import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db";

export type UserRow = {
	id: number;
	display_name: string;
	country: string | null;
	level: number;
	xp: number;
	active_avatar_id: number | null;
};

export async function findUserById(userId: number): Promise<UserRow | null> {
	const [rows] = await pool.query<(UserRow & RowDataPacket)[]>(
		`SELECT id, display_name, country, level, xp, active_avatar_id
		   FROM users
		  WHERE id = ?`,
		[userId],
	);
	return rows[0] ?? null;
}

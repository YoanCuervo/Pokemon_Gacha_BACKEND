import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db";

export type PhotoRow = {
	id: number;
	slot_position: number;
	file_path: string;
};

/** Les photos d'un joueur, triees par slot. */
export async function findPhotosByUser(userId: number): Promise<PhotoRow[]> {
	const [rows] = await pool.query<(PhotoRow & RowDataPacket)[]>(
		`SELECT id, slot_position, file_path
		   FROM user_photos
		  WHERE user_id = ?
		  ORDER BY slot_position`,
		[userId],
	);
	return rows;
}

/** Une photo precise, avec son user_id : sert a verifier l'appartenance. */
export async function findPhotoById(
	photoId: number,
): Promise<(PhotoRow & { user_id: number }) | null> {
	const [rows] = await pool.query<
		(PhotoRow & { user_id: number } & RowDataPacket)[]
	>(
		`SELECT id, user_id, slot_position, file_path
		   FROM user_photos
		  WHERE id = ?`,
		[photoId],
	);
	return rows[0] ?? null;
}

export async function insertPhoto(
	userId: number,
	slotPosition: number,
	filePath: string,
): Promise<number> {
	const [result] = await pool.query<ResultSetHeader>(
		`INSERT INTO user_photos (user_id, slot_position, file_path)
		 VALUES (?, ?, ?)`,
		[userId, slotPosition, filePath],
	);
	return result.insertId;
}

export async function deletePhoto(photoId: number): Promise<number> {
	const [result] = await pool.query<ResultSetHeader>(
		`DELETE FROM user_photos WHERE id = ?`,
		[photoId],
	);
	return result.affectedRows;
}

/** L'ecriture du choix "Utiliser". */
export async function updateActivePhoto(
	userId: number,
	photoId: number,
): Promise<number> {
	const [result] = await pool.query<ResultSetHeader>(
		`UPDATE users SET active_avatar_id = ? WHERE id = ?`,
		[photoId, userId],
	);
	return result.affectedRows;
}

/** La photo active du joueur, pour le GET. */
export async function findActivePhotoId(
	userId: number,
): Promise<number | null> {
	const [rows] = await pool.query<
		({ active_avatar_id: number | null } & RowDataPacket)[]
	>(`SELECT active_avatar_id FROM users WHERE id = ?`, [userId]);
	return rows[0]?.active_avatar_id ?? null;
}

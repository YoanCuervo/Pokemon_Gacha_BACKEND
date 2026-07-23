import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";

export interface XpStateRow extends RowDataPacket {
	instance_id: number;
	level: number;
	xp: number;
	candies_owned: number;
	current_level_xp: number;
	next_level_xp: number | null;
}

const XP_STATE_SELECT = (forUpdate: boolean): string => `
	SELECT
		pi.id                     AS instance_id,
		pi.level,
		pi.xp,
		COALESCE(uc.quantity, 0)  AS candies_owned,
		COALESCE(lc.xp_required, 0) AS current_level_xp,
		lcn.xp_required           AS next_level_xp
	FROM pokemon_instances pi
	LEFT JOIN user_candies uc
		ON uc.user_id = pi.user_id AND uc.candy_type = 'xp'
	LEFT JOIN level_costs lc  ON lc.level = pi.level
	LEFT JOIN level_costs lcn ON lcn.level = pi.level + 1
	WHERE pi.id = ? AND pi.user_id = ?
	${forUpdate ? "FOR UPDATE" : "LIMIT 1"}`;

export async function findXpState(
	instanceId: number,
	userId: number,
): Promise<XpStateRow | null> {
	const [rows] = await pool.query<XpStateRow[]>(XP_STATE_SELECT(false), [
		instanceId,
		userId,
	]);
	return rows[0] ?? null;
}

export async function lockXpStateForUpdate(
	conn: PoolConnection,
	instanceId: number,
	userId: number,
): Promise<XpStateRow | null> {
	const [rows] = await conn.query<XpStateRow[]>(XP_STATE_SELECT(true), [
		instanceId,
		userId,
	]);
	return rows[0] ?? null;
}

export async function findLevelForXp(
	conn: PoolConnection,
	xp: number,
): Promise<number> {
	const [rows] = await conn.query<RowDataPacket[]>(
		`SELECT MAX(level) AS level FROM level_costs WHERE xp_required <= ?`,
		[xp],
	);

	return Number(rows[0]?.level ?? 1);
}

export async function findMaxLevel(): Promise<number> {
	const [rows] = await pool.query<RowDataPacket[]>(
		`SELECT MAX(level) AS level FROM level_costs`,
	);
	return Number(rows[0]?.level ?? 1);
}

export async function consumeCandies(
	conn: PoolConnection,
	userId: number,
	amount: number,
): Promise<void> {
	await conn.query(
		`UPDATE user_candies
		SET quantity = quantity - ?
		WHERE user_id = ? AND candy_type = 'xp'`,
		[amount, userId],
	);
}

export async function setXpAndLevel(
	conn: PoolConnection,
	instanceId: number,
	xp: number,
	level: number,
): Promise<void> {
	await conn.query(
		`UPDATE pokemon_instances
		SET xp = ?, level = ?
		WHERE id = ?`,
		[xp, level, instanceId],
	);
}

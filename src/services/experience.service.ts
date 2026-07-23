import { pool } from "../config/db";
import {
	consumeCandies,
	findLevelForXp,
	findMaxLevel,
	findXpState,
	lockXpStateForUpdate,
	setXpAndLevel,
} from "../models/experience.model";
import { findAllSettings } from "../models/settings.model";
import type { XpState } from "../types";

export class ExperienceError extends Error {
	constructor(
		public code:
			| "NOT_FOUND"
			| "MAX_LEVEL"
			| "NOT_ENOUGH_CANDIES"
			| "INVALID_AMOUNT",
	) {
		super(code);
		this.name = "ExperienceError";
	}
}

async function loadCandyXpValue(): Promise<number> {
	const settings = await findAllSettings();
	return Number(settings.candy_xp_value ?? 100);
}

export async function getXpState(
	instanceId: number,
	userId: number,
): Promise<XpState> {
	const [row, candyXpValue, maxLevel] = await Promise.all([
		findXpState(instanceId, userId),
		loadCandyXpValue(),
		findMaxLevel(),
	]);

	if (!row) throw new ExperienceError("NOT_FOUND");

	const isMax = row.level >= maxLevel || row.next_level_xp === null;

	const xpIntoLevel = row.xp - row.current_level_xp;
	const xpForNextLevel = isMax
		? 0
		: (row.next_level_xp as number) - row.current_level_xp;

	return {
		instance_id: row.instance_id,
		level: row.level,
		max_level: maxLevel,
		xp: row.xp,
		xp_into_level: xpIntoLevel,
		xp_for_next_level: xpForNextLevel,
		candies_owned: row.candies_owned,
		candy_xp_value: candyXpValue,
		is_max_level: isMax,
	};
}

export async function useCandies(
	instanceId: number,
	amount: number,
	userId: number,
): Promise<XpState> {
	if (!Number.isInteger(amount) || amount <= 0) {
		throw new ExperienceError("INVALID_AMOUNT");
	}

	const [candyXpValue, maxLevel] = await Promise.all([
		loadCandyXpValue(),
		findMaxLevel(),
	]);

	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();

		const state = await lockXpStateForUpdate(conn, instanceId, userId);
		if (!state) throw new ExperienceError("NOT_FOUND");

		// Deja au maximum : on refuse plutot que de bruler des bonbons.
		if (state.level >= maxLevel) throw new ExperienceError("MAX_LEVEL");

		if (state.candies_owned < amount) {
			throw new ExperienceError("NOT_ENOUGH_CANDIES");
		}

		const gained = amount * candyXpValue;
		const newXp = state.xp + gained;
		const newLevel = Math.min(await findLevelForXp(conn, newXp), maxLevel);

		await consumeCandies(conn, userId, amount);
		await setXpAndLevel(conn, instanceId, newXp, newLevel);

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}

	return getXpState(instanceId, userId);
}

import type { Request, Response } from "express";
import { getStones } from "../services/stones.service";

/**
 * CONTROLLER — HTTP seul.
 * Pas de validation de params : la route n'en prend aucun (le user vient de getUserId, pas du client). Pas de mapping d'erreur metier : le service n'en leve aucune (lecture pure).
 */

// Meme point de bascule que team/box/pokemon : DEV_USER_ID en attendant le JWT.
function getUserId(): number {
	return Number(process.env.DEV_USER_ID ?? 1);
}

export async function getStonesHandler(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const stones = await getStones(getUserId());
		res.status(200).json(stones);
	} catch (err) {
		console.error("GET /api/stones failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

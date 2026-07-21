import type { Request, Response } from "express";
import { getReserve } from "../services/item.service";

// Meme point de bascule que team/box/pokemon : DEV_USER_ID en attendant le JWT.
function getUserId(): number {
	return Number(process.env.DEV_USER_ID ?? 1);
}

export async function getReserveHandler(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const items = await getReserve(getUserId());
		res.status(200).json({ items });
	} catch (err) {
		console.error("GET /api/items/reserve failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

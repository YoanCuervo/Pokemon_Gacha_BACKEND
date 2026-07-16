import type { Request, Response } from "express";
import { getBox } from "../services/box.service";

// Meme point de bascule que team.controller : DEV_USER_ID en attendant le JWT
function getUserId(): number {
	return Number(process.env.DEV_USER_ID ?? 1);
}

export async function getBoxHandler(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const instances = await getBox(getUserId());
		res.status(200).json({ instances });
	} catch (err) {
		console.error("GET /api/box failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

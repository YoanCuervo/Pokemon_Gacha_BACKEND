import type { Request, Response } from "express";
import { getInstanceDetail, InventoryError } from "../services/pokemon.service";

// Meme point de bascule que team/box : DEV_USER_ID en attendant le JWT.
function getUserId(): number {
	return Number(process.env.DEV_USER_ID ?? 1);
}

export async function getInstanceHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const detail = await getInstanceDetail(instanceId, getUserId());
		res.status(200).json(detail);
	} catch (err) {
		if (err instanceof InventoryError && err.code === "NOT_FOUND") {
			res.status(404).json({ error: "NOT_FOUND" });
			return;
		}
		console.error("GET /api/pokemon/:instanceId failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

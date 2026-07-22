import type { Request, Response } from "express";
import {
	equipItem,
	evolveInstance,
	getEvolutionInfo,
	getInstanceDetail,
	InventoryError,
	unequipItem,
} from "../services/pokemon.service";
import type { ItemCategory } from "../types";

// Meme point de bascule que team/box : DEV_USER_ID en attendant le JWT.
function getUserId(): number {
	return Number(process.env.DEV_USER_ID ?? 1);
}

const VALID_CATEGORIES: readonly ItemCategory[] = [
	"att",
	"def",
	"speed",
	"spe",
];

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

export async function equipHandler(req: Request, res: Response): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	const itemInstanceId = Number(req.body?.item_instance_id);

	if (
		!Number.isInteger(instanceId) ||
		instanceId <= 0 ||
		!Number.isInteger(itemInstanceId) ||
		itemInstanceId <= 0
	) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const detail = await equipItem(instanceId, itemInstanceId, getUserId());
		res.status(200).json(detail);
	} catch (err) {
		if (err instanceof InventoryError) {
			if (err.code === "NOT_FOUND") {
				res.status(404).json({ error: "NOT_FOUND" });
				return;
			}
			if (err.code === "ITEM_NOT_FOUND") {
				res.status(404).json({ error: "ITEM_NOT_FOUND" });
				return;
			}
		}
		console.error("PATCH /api/pokemon/:instanceId/equip failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

export async function unequipHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	const category = req.body?.category as unknown;

	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}
	if (
		typeof category !== "string" ||
		!VALID_CATEGORIES.includes(category as ItemCategory)
	) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const detail = await unequipItem(
			instanceId,
			category as ItemCategory,
			getUserId(),
		);
		res.status(200).json(detail);
	} catch (err) {
		if (err instanceof InventoryError && err.code === "NOT_FOUND") {
			res.status(404).json({ error: "NOT_FOUND" });
			return;
		}
		console.error("PATCH /api/pokemon/:instanceId/unequip failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

export async function getEvolutionHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const info = await getEvolutionInfo(instanceId, getUserId());
		res.status(200).json(info);
	} catch (err) {
		if (err instanceof InventoryError && err.code === "NOT_FOUND") {
			res.status(404).json({ error: "NOT_FOUND" });
			return;
		}
		console.error("GET /api/pokemon/:instanceId/evolution failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

export async function evolveHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const detail = await evolveInstance(instanceId, getUserId());
		res.status(200).json(detail);
	} catch (err) {
		if (err instanceof InventoryError) {
			if (err.code === "NOT_FOUND") {
				res.status(404).json({ error: "NOT_FOUND" });
				return;
			}
			// Stade final ou pierres insuffisantes : conflit d'etat -> 409.
			if (err.code === "CANNOT_EVOLVE" || err.code === "NOT_ENOUGH_STONES") {
				res.status(409).json({ error: err.code });
				return;
			}
		}
		console.error("POST /api/pokemon/:instanceId/evolve failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

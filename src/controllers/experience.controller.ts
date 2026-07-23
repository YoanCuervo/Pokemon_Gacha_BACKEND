import type { Request, Response } from "express";
import {
	ExperienceError,
	getXpState,
	useCandies,
} from "../services/experience.service";

function getUserId(): number {
	return Number(process.env.DEV_USER_ID ?? 1);
}

function sendExperienceError(res: Response, err: unknown, route: string): void {
	if (err instanceof ExperienceError) {
		if (err.code === "NOT_FOUND") {
			res.status(404).json({ error: "NOT_FOUND" });
			return;
		}
		if (err.code === "INVALID_AMOUNT") {
			res.status(400).json({ error: err.code });
			return;
		}

		res.status(409).json({ error: err.code });
		return;
	}
	console.error(`${route} failed:`, err);
	res.status(500).json({ error: "INTERNAL" });
}

export async function getExperienceHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const state = await getXpState(instanceId, getUserId());
		res.status(200).json(state);
	} catch (err) {
		sendExperienceError(res, err, "GET /api/pokemon/:instanceId/experience");
	}
}

export async function useCandiesHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	const amount = Number(req.body?.amount);
	if (!Number.isInteger(amount) || amount <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const state = await useCandies(instanceId, amount, getUserId());
		res.status(200).json(state);
	} catch (err) {
		sendExperienceError(res, err, "POST /api/pokemon/:instanceId/experience");
	}
}

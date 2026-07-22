import type { Request, Response } from "express";
import {
	decraftInstances,
	getPowerState,
	PowerError,
	upgradeStar,
} from "../services/power.service";

/**
 * CONTROLLER — HTTP seul.
 * Valide la forme des entrees (id positif, tableau d'ids), traduit les
 * erreurs metier en codes HTTP. Aucune regle de jeu ici.
 */

// Meme point de bascule que team/box/pokemon : DEV_USER_ID en attendant le JWT.
function getUserId(): number {
	return Number(process.env.DEV_USER_ID ?? 1);
}

/** Mapping commun des erreurs metier -> HTTP.
 *  404 : la ressource n'existe pas / n'est pas au joueur.
 *  409 : conflit d'etat (deja au max, pas assez, sacrifice invalide).
 *  400 : le client a envoye une demande vide. */
function sendPowerError(res: Response, err: unknown, route: string): void {
	if (err instanceof PowerError) {
		if (err.code === "NOT_FOUND") {
			res.status(404).json({ error: "NOT_FOUND" });
			return;
		}
		if (err.code === "NOTHING_TO_DECRAFT") {
			res.status(400).json({ error: err.code });
			return;
		}
		// MAX_STARS, NOT_ENOUGH_FRAGMENTS, INVALID_SACRIFICE
		res.status(409).json({ error: err.code });
		return;
	}
	console.error(`${route} failed:`, err);
	res.status(500).json({ error: "INTERNAL" });
}

export async function getPowerHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const state = await getPowerState(instanceId, getUserId());
		res.status(200).json(state);
	} catch (err) {
		sendPowerError(res, err, "GET /api/pokemon/:instanceId/power");
	}
}

export async function upgradeStarHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const state = await upgradeStar(instanceId, getUserId());
		res.status(200).json(state);
	} catch (err) {
		sendPowerError(res, err, "POST /api/pokemon/:instanceId/star");
	}
}

export async function decraftHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const instanceId = Number(req.params.instanceId);
	if (!Number.isInteger(instanceId) || instanceId <= 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	// Le body vient du client : donnee hostile. On valide la FORME ici
	// (tableau d'entiers positifs) ; le service et le SQL valident les
	// REGLES (propriete, ligne evolutive, hors equipe).
	const raw = req.body?.instance_ids as unknown;
	if (!Array.isArray(raw) || raw.length === 0) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	const instanceIds = raw.map(Number);
	if (instanceIds.some((id) => !Number.isInteger(id) || id <= 0)) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const result = await decraftInstances(instanceId, instanceIds, getUserId());
		res.status(200).json(result);
	} catch (err) {
		sendPowerError(res, err, "POST /api/pokemon/:instanceId/decraft");
	}
}

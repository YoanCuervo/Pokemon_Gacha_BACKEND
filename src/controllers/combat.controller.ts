import type { Request, Response } from "express";
import { CombatError, runMirrorCombat } from "../services/combat.service";

/**
 * CONTROLLER — HTTP seul : lit la requete, appelle le service,
 * traduit les erreurs metier en codes HTTP.
 */

/** Meme point de bascule JWT que le reste du projet. */
function getUserId(): number {
	return Number(process.env.DEV_USER_ID ?? 1);
}

export async function postCombat(_req: Request, res: Response): Promise<void> {
	try {
		const log = await runMirrorCombat(getUserId());
		res.status(200).json(log);
	} catch (err) {
		if (err instanceof CombatError) {
			// EMPTY_TEAM : la ressource necessaire n'existe pas -> 409
			// (conflit avec l'etat : il faut d'abord composer une equipe).
			res.status(409).json({ error: err.message, code: err.code });
			return;
		}
		console.error("POST /api/combat", err);
		res.status(500).json({ error: "Erreur serveur" });
	}
}

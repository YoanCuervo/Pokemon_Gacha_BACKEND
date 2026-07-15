import type { Request, Response } from "express";
import {
	addToTeam,
	getTeam,
	removeFromTeam,
	reorderTeam,
	TeamError,
} from "../services/team.service";

/**
 * CONTROLLER — la couche HTTP.
 *
 * Elle lit req, appelle le service, renvoie res. Aucune regle du jeu,
 * aucun SQL. Si tu vois une requete SQL ici, c'est mal place.
 *
 * Repartition des validations :
 *   controller -> le FORMAT   ("est-ce un nombre ?")
 *   service    -> les REGLES  ("ce pokemon t'appartient-il ?")
 */

/**
 * Tant que l'auth n'existe pas, on travaille avec un joueur en dur.
 *
 * Le jour ou le JWT arrive, cette fonction lira req.user.id et c'est
 * tout — les controllers n'auront pas a changer. C'est la raison de
 * l'isoler plutot que d'ecrire DEV_USER_ID partout.
 */
function getUserId(_req: Request): number {
	return Number(process.env.DEV_USER_ID) || 1;
}

/**
 * Traduit une erreur metier en reponse HTTP.
 *
 * Le service dit CE QUI a echoue (err.code), le controller decide du
 * CODE HTTP. Chaque couche son travail.
 */
function handleError(err: unknown, res: Response): void {
	if (err instanceof TeamError) {
		const status = {
			NOT_OWNED: 403,
			NOT_FOUND: 404,
			DUPLICATE: 409,
			TEAM_FULL: 409,
			VALIDATION: 400,
		}[err.code];

		res.status(status).json({ error: err.message });
		return;
	}

	// ER_DUP_ENTRY : une contrainte UNIQUE a saute.
	// Sur team_slots, deux candidates :
	//   uq_ts_slot     -> le slot est deja occupe
	//   uq_ts_instance -> ce pokemon est deja dans l'equipe
	//
	// On ne verifie pas avant l'INSERT : entre un SELECT et un INSERT,
	// une autre requete peut passer (race condition). La contrainte,
	// elle, est evaluee PENDANT l'ecriture. C'est atomique.
	if (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		err.code === "ER_DUP_ENTRY"
	) {
		res.status(409).json({
			error: "Ce slot est deja occupe, ou ce pokemon est deja dans l'equipe",
		});
		return;
	}

	console.error("Erreur non geree :", err);
	res.status(500).json({ error: "Erreur serveur" });
}

/**
 * GET /api/team
 */
export async function getTeamHandler(req: Request, res: Response) {
	try {
		const team = await getTeam(getUserId(req));
		res.json(team);
	} catch (err) {
		handleError(err, res);
	}
}

/**
 * POST /api/team
 * body : { pokemon_instance_id, slot_position }
 */
export async function addToTeamHandler(req: Request, res: Response) {
	try {
		const { pokemon_instance_id, slot_position } = req.body;

		// Le body vient du client : rien n'est garanti. Un JSON peut
		// contenir n'importe quoi, y compris rien du tout.
		if (
			!Number.isInteger(pokemon_instance_id) ||
			!Number.isInteger(slot_position)
		) {
			res.status(400).json({
				error: "pokemon_instance_id et slot_position doivent etre des entiers",
			});
			return;
		}

		await addToTeam(getUserId(req), pokemon_instance_id, slot_position);
		res.status(201).json({ message: "Pokemon ajoute a l'equipe" });
	} catch (err) {
		handleError(err, res);
	}
}

/**
 * PATCH /api/team/reorder
 * body : { order: [12, 45, 3, 8, 21, 7] }
 */
export async function reorderTeamHandler(req: Request, res: Response) {
	try {
		const { order } = req.body;

		if (!Array.isArray(order) || !order.every(Number.isInteger)) {
			res.status(400).json({
				error: "order doit etre un tableau d'entiers",
			});
			return;
		}

		await reorderTeam(getUserId(req), order);
		res.json({ message: "Equipe reordonnee" });
	} catch (err) {
		handleError(err, res);
	}
}

/**
 * DELETE /api/team/:slot
 */
export async function removeFromTeamHandler(req: Request, res: Response) {
	try {
		// Piege Express : req.params est TOUJOURS une string.
		// req.params.slot vaut "3", pas 3. Et Number("abc") renvoie NaN
		// sans lever d'erreur — d'ou le Number.isInteger derriere.
		const slot = Number(req.params.slot);

		if (!Number.isInteger(slot)) {
			res.status(400).json({ error: "Le slot doit etre un entier" });
			return;
		}

		await removeFromTeam(getUserId(req), slot);
		res.json({ message: "Pokemon retire de l'equipe" });
	} catch (err) {
		handleError(err, res);
	}
}

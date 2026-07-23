import type { Request, Response } from "express";
import { findAllItemTemplates, findAllSpecies } from "../models/sandbox.model";
import {
	previewSandboxTeams,
	runSandboxCombat,
	SandboxError,
} from "../services/sandbox.service";
import type {
	SandboxMember,
	SandboxPayload,
	SandboxTeam,
} from "../types/combat";

/**
 * CONTROLLER — HTTP seul.
 *
 * Le payload vient du client : donnee hostile. Trois couches de
 * validation, chacune a sa place :
 *   - ICI      : la FORME (structure, types, champs presents)
 *   - service  : les REGLES (bornes, doublons de categorie, taille)
 *   - model    : l'EXISTENCE (un id absent du catalogue est invalide)
 */

// ---------------------------------------------------------------------
// Catalogues (alimentent les selecteurs du front)
// ---------------------------------------------------------------------

/** Le catalogue des especes (251) pour le selecteur du front. */
export async function getSpeciesCatalogHandler(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const species = await findAllSpecies();
		res.status(200).json({ species });
	} catch (err) {
		console.error("GET /api/sandbox/species failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

/** Le catalogue des items equipables pour le selecteur du front. */
export async function getItemCatalogHandler(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const items = await findAllItemTemplates();
		res.status(200).json({ items });
	} catch (err) {
		console.error("GET /api/sandbox/items failed:", err);
		res.status(500).json({ error: "INTERNAL" });
	}
}

// ---------------------------------------------------------------------
// Validation de forme (partagee par combat et preview)
// ---------------------------------------------------------------------

/** Vrai si la valeur est un entier strictement positif. */
function isPositiveInt(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) > 0;
}

/**
 * Valide la FORME d'un membre et le normalise.
 * Renvoie null si la structure est invalide -> le handler repond 400.
 * On ne verifie PAS les bornes ici (regle de jeu, elle vit dans le
 * service) : juste que les champs existent et ont le bon type.
 */
function parseMember(raw: unknown): SandboxMember | null {
	if (typeof raw !== "object" || raw === null) return null;
	const m = raw as Record<string, unknown>;

	if (!isPositiveInt(m.pokemon_id)) return null;
	if (!Number.isInteger(m.level)) return null;
	if (!Number.isInteger(m.stars)) return null;

	// item_template_ids est optionnel : un pokemon nu est valide.
	const rawItems = m.item_template_ids ?? [];
	if (!Array.isArray(rawItems)) return null;
	const items = rawItems.map(Number);
	if (items.some((id) => !isPositiveInt(id))) return null;

	return {
		pokemon_id: m.pokemon_id,
		level: m.level as number,
		stars: m.stars as number,
		is_shiny: Boolean(m.is_shiny),
		item_template_ids: items,
	};
}

/** Valide la FORME d'une equipe. null si invalide. */
function parseTeam(raw: unknown): SandboxTeam | null {
	if (typeof raw !== "object" || raw === null) return null;
	const t = raw as Record<string, unknown>;

	if (!Array.isArray(t.members)) return null;

	const members: SandboxMember[] = [];
	for (const rawMember of t.members) {
		const member = parseMember(rawMember);
		if (!member) return null;
		members.push(member);
	}

	return {
		name: typeof t.name === "string" ? t.name : "",
		members,
	};
}

/** Valide la FORME du payload complet. null si invalide.
 *  Partage par les deux POST : meme contrat d'entree. */
function parsePayload(body: unknown): SandboxPayload | null {
	const rawTeams = (body as Record<string, unknown> | undefined)?.teams;
	if (typeof rawTeams !== "object" || rawTeams === null) return null;

	const teams = rawTeams as Record<string, unknown>;
	const a = parseTeam(teams.a);
	const b = parseTeam(teams.b);
	if (!a || !b) return null;

	return { teams: { a, b } };
}

/** Mapping commun des erreurs metier -> HTTP.
 *  Toutes les SandboxError sont des compos invalides : le client a
 *  envoye quelque chose d'incoherent -> 400, jamais 409. */
function sendSandboxError(res: Response, err: unknown, route: string): void {
	if (err instanceof SandboxError) {
		res.status(400).json({ error: err.code, message: err.message });
		return;
	}
	console.error(`${route} failed:`, err);
	res.status(500).json({ error: "INTERNAL" });
}

// ---------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------

/** Stats des deux compos, SANS lancer le combat (preview temps reel). */
export async function postSandboxPreviewHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const payload = parsePayload(req.body);
	if (!payload) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const preview = await previewSandboxTeams(payload);
		res.status(200).json(preview);
	} catch (err) {
		sendSandboxError(res, err, "POST /api/sandbox/preview");
	}
}

/** Resout le combat et renvoie le log complet.
 *  POST et non GET : la resolution tire du random, ce n'est pas une
 *  lecture cachable (meme raison que /api/combat). */
export async function postSandboxCombatHandler(
	req: Request,
	res: Response,
): Promise<void> {
	const payload = parsePayload(req.body);
	if (!payload) {
		res.status(400).json({ error: "VALIDATION" });
		return;
	}

	try {
		const log = await runSandboxCombat(payload);
		res.status(200).json(log);
	} catch (err) {
		sendSandboxError(res, err, "POST /api/sandbox/combat");
	}
}

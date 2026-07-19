import { findCombatTeamByUserId } from "../models/combat.model";
import { findAllSettings } from "../models/settings.model";
import type { CombatLog } from "../types/combat";
import { type CombatSettings, resolveCombat } from "./combat/engine";
import { prepareTeam } from "./combat/prepare";
import type { StatCoeffs } from "./stats";

/**
 * SERVICE — orchestration du combat.
 * Charge les equipes, prepare, resout, retourne le log. Aucun HTTP ici.
 *
 * V1 : combat MIROIR — l'equipe du joueur contre elle-meme (il n'existe
 * qu'un joueur en base). Le jour du PVE/PVP, cette fonction prendra
 * l'identite de l'adversaire ; toute la chaine en dessous est prete.
 */

export class CombatError extends Error {
	constructor(
		message: string,
		public readonly code: "EMPTY_TEAM",
	) {
		super(message);
		this.name = "CombatError";
	}
}

export async function runMirrorCombat(userId: number): Promise<CombatLog> {
	const [settings, rows] = await Promise.all([
		findAllSettings(),
		findCombatTeamByUserId(userId),
	]);

	if (rows.length === 0) {
		throw new CombatError("Ton equipe est vide", "EMPTY_TEAM");
	}

	const coeffs: StatCoeffs = {
		star: settings.star_stat_coeff ?? 0.1,
		level: settings.level_stat_coeff ?? 0.02,
	};
	const combatSettings: CombatSettings = {
		crit_chance_step: settings.crit_chance_step ?? 0.05,
		crit_multiplier: settings.crit_multiplier ?? 1.5,
		max_actions: settings.max_actions ?? 1000,
	};

	// Deux preparations INDEPENDANTES des memes lignes : uids "a*"/"b*"
	// distincts, et surtout deux jeux de Fighter separes — le moteur
	// MUTE la vie, partager les objets fausserait tout le combat.
	const teamA = prepareTeam("a", userId, rows, coeffs);
	const teamB = prepareTeam("b", userId, rows, coeffs);

	return resolveCombat(teamA, teamB, combatSettings);
}

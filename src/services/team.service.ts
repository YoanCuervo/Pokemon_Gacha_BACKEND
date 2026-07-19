import { findAllSettings } from "../models/settings.model";
import {
	deleteTeamSlot,
	findTeamByUserId,
	insertTeamSlot,
	instanceBelongsToUser,
	replaceTeamOrder,
} from "../models/team.model";
import type {
	ComputedStats,
	EquippedItem,
	TeamMember,
	TeamResponse,
	TeamSlotRow,
} from "../types";
import { computeStat, type StatCoeffs } from "./stats";

/**
 * SERVICE — les regles du jeu.
 *
 * Cette couche ne connait ni le SQL ni HTTP. Si tu vois `req` ou `res`
 * ici, c'est mal place. Si tu vois une requete SQL, aussi.
 *
 * Regle R6 : le calcul se fait cote serveur, jamais cote client.
 * Un client peut etre modifie par le joueur.
 */

/** Erreur metier. Le controller la traduira en code HTTP. */
export class TeamError extends Error {
	constructor(
		message: string,
		public readonly code:
			| "NOT_OWNED"
			| "TEAM_FULL"
			| "DUPLICATE"
			| "NOT_FOUND"
			| "VALIDATION",
	) {
		super(message);
		this.name = "TeamError";
	}
}

/* Duplique dans game_settings.team_size — LA CONSTANTE FAIT FOI.
 * On assume la duplication : lire la base a chaque validation pour une
 * valeur qui ne change jamais en cours de partie serait de la
 * sur-ingenierie. Si un jour l'equipe passe a 5, changer ici ET en base.*/
const TEAM_SIZE = 6;

/**
 * Regle R7 — deleguee a services/stats.ts, LE canal unique de calcul
 * (partage avec le moteur de combat : un seul endroit ou la formule et
 * l'arrondi existent, sinon affichage et combat divergent en silence).
 *
 * Mapping items depuis la refonte du 18/07 : chaque item booste SA
 * stat (att -> atk, def -> def, speed -> speed). HP n'est booste par
 * aucun item : la VIE de combat fusionne deja HP + DEF + SPD.
 * (L'ancienne dette "def booste hp ET def" est resolue ici.)
 */
function computeStats(
	row: TeamSlotRow,
	items: EquippedItem[],
	coeffs: StatCoeffs,
): ComputedStats {
	const boostFor = (category: string) =>
		items
			.filter((it) => it.category === category)
			.reduce((sum, it) => sum + it.boost_value, 0);

	return {
		atk: computeStat(
			row.base_atk,
			row.stars,
			row.level,
			boostFor("att"),
			coeffs,
		),
		hp: computeStat(row.base_hp, row.stars, row.level, 0, coeffs),
		def: computeStat(
			row.base_def,
			row.stars,
			row.level,
			boostFor("def"),
			coeffs,
		),
		speed: computeStat(
			row.base_speed,
			row.stars,
			row.level,
			boostFor("speed"),
			coeffs,
		),
	};
}

/*Regroupe les lignes plates de la requete en objets par pokemon.
 * La requete renvoie jusqu'a 24 lignes (6 pokemon x 4 items). Chaque pokemon est duplique une fois par item. Ici on les recolle.
 * Le Map est cle par slot_position : c'est l'identifiant naturel d'un membre d'equipe, et il est unique par la contrainte uq_ts_slot.*/
function groupRows(rows: TeamSlotRow[], coeffs: StatCoeffs): TeamMember[] {
	const bySlot = new Map<number, TeamSlotRow[]>();

	for (const row of rows) {
		const existing = bySlot.get(row.slot_position);
		if (existing) {
			existing.push(row);
		} else {
			bySlot.set(row.slot_position, [row]);
		}
	}

	const members: TeamMember[] = [];

	for (const [slot, slotRows] of bySlot) {
		const first = slotRows[0];

		// Impossible en pratique : on ne cree une entree du Map qu'en y
		// mettant une ligne, donc slotRows n'est jamais vide. Mais TS ne
		// peut pas le deduire (noUncheckedIndexedAccess), et un `!` ou un
		// `as` mentirait. On sort proprement.
		if (!first) continue;

		// item_id est NULL quand le pokemon n'a pas d'item (LEFT JOIN).
		// Sans ce filtre, on creerait un item fantome avec des champs null.
		const items: EquippedItem[] = slotRows
			.filter((r) => r.item_id !== null)
			.map((r) => ({
				id: r.item_id as number,
				name: r.item_name as string,
				category: r.item_category as EquippedItem["category"],
				mode: r.item_mode,
				boost_value: r.item_boost as number,
			}));

		members.push({
			slot_position: slot,
			instance_id: first.instance_id,
			pokemon_id: first.pokemon_id,
			name: first.name,
			type_primary: first.type_primary,
			type_secondary: first.type_secondary,
			stars: first.stars,
			level: first.level,
			is_shiny: first.is_shiny,
			items,
			stats: computeStats(first, items, coeffs),
		});
	}

	return members;
}

/*READ — l'equipe complete, prete a afficher.
 * Deux requetes : les reglages, puis l'equipe. Les coefficients sont lus a chaque appel pour que reequilibrer avec un UPDATE en base prenne effet sans redemarrer le serveur.*/
export async function getTeam(userId: number): Promise<TeamResponse> {
	const [settings, rows] = await Promise.all([
		findAllSettings(),
		findTeamByUserId(userId),
	]);

	const coeffs: StatCoeffs = {
		star: settings.star_stat_coeff ?? 0.1,
		level: settings.level_stat_coeff ?? 0.02,
	};

	const members = groupRows(rows, coeffs);

	// Regle R6 : la somme des vitesses decide de l'initiative entre les
	// deux joueurs. C'est la seule stat d'equipe qui a un effet mecanique.
	const totalSpeed = members.reduce((sum, m) => sum + m.stats.speed, 0);

	return { members, total_speed: totalSpeed };
}

/*CREATE — place un pokemon dans un slot.*/
export async function addToTeam(
	userId: number,
	pokemonInstanceId: number,
	slotPosition: number,
): Promise<void> {
	if (slotPosition < 1 || slotPosition > TEAM_SIZE) {
		throw new TeamError(
			`Le slot doit etre entre 1 et ${TEAM_SIZE}`,
			"VALIDATION",
		);
	}

	// Le pokemon_instance_id vient du client : donnee hostile jusqu'a
	// preuve du contraire. La FK garantit que l'instance existe, pas
	// qu'elle appartient a ce joueur.
	const owned = await instanceBelongsToUser(userId, pokemonInstanceId);
	if (!owned) {
		throw new TeamError("Ce pokemon ne t'appartient pas", "NOT_OWNED");
	}

	await insertTeamSlot(userId, pokemonInstanceId, slotPosition);
}

/**
 * UPDATE — reordonne l'equipe complete.
 *
 * Le front envoie l'ordre final : [12, 45, 3, 8, 21, 7].
 * Le tableau vient du client, donc chaque id est verifie.
 */
export async function reorderTeam(
	userId: number,
	order: number[],
): Promise<void> {
	if (order.length > TEAM_SIZE) {
		throw new TeamError(
			`L'equipe fait ${TEAM_SIZE} pokemon maximum`,
			"TEAM_FULL",
		);
	}

	// Un Set dedoublonne : si sa taille differe, il y avait un doublon.
	// La contrainte uq_ts_instance l'attraperait aussi, mais autant
	// renvoyer une erreur claire plutot qu'un ER_DUP_ENTRY brut.
	if (new Set(order).size !== order.length) {
		throw new TeamError(
			"Un pokemon ne peut pas etre deux fois dans l'equipe",
			"DUPLICATE",
		);
	}

	// Chaque id du tableau est verifie. En parallele : 6 requetes
	// concurrentes plutot que 6 sequentielles.
	const checks = await Promise.all(
		order.map((id) => instanceBelongsToUser(userId, id)),
	);
	if (checks.includes(false)) {
		throw new TeamError("Un des pokemon ne t'appartient pas", "NOT_OWNED");
	}

	await replaceTeamOrder(userId, order);
}

/**
 * DELETE — retire le pokemon d'un slot.
 */
export async function removeFromTeam(
	userId: number,
	slotPosition: number,
): Promise<void> {
	const deleted = await deleteTeamSlot(userId, slotPosition);
	if (!deleted) {
		throw new TeamError("Ce slot est deja vide", "NOT_FOUND");
	}
}

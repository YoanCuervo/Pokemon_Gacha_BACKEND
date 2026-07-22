import { pool } from "../config/db";
import {
	addCandies,
	addFragments,
	consumeFragments,
	type DecraftableRow,
	deleteInstances,
	findDecraftable,
	findStarCosts,
	findStarState,
	incrementStar,
	lockDecraftablesForUpdate,
	lockStarStateForUpdate,
} from "../models/power.model";
import { findAllSettings } from "../models/settings.model";
import type { DecraftResult, PowerState } from "../types";

/**
 * SERVICE — les regles du jeu (onglet PUISSANCE).
 *
 * Deux gestes :
 *  - R2 : monter une etoile en depensant des fragments du pot.
 *  - R1 : decrafter des doublons (meme ligne evolutive) pour alimenter
 *         ce pot, + recuperer 25% de leur XP totale en bonbons.
 *
 * "Doublon" = meme evolution_line_id que la cible (le pot de fragments
 * est par ligne evolutive, pas par espece).
 *
 * Le service est AUTONOME : il lit lui-meme star_costs et game_settings.
 * Le controller ne lui passe que l'instance et l'utilisateur — il ne
 * peut pas oublier de charger un bareme ni en fournir un incomplet.
 */

export class PowerError extends Error {
	constructor(
		public code:
			| "NOT_FOUND"
			| "MAX_STARS"
			| "NOT_ENOUGH_FRAGMENTS"
			| "NOTHING_TO_DECRAFT"
			| "INVALID_SACRIFICE",
	) {
		super(code);
		this.name = "PowerError";
	}
}

/** Plancher de rendement : un pokemon 0 etoile rend 1 fragment.
 *  Pas de ligne star_costs pour 0 -> valeur codee ici, assumee. */
const ZERO_STAR_REFUND = 1;

/**
 * Rendement en fragments d'une instance sacrifiee : la MOITIE du cout
 * de son niveau d'etoile (regle actee). Derive de star_costs, jamais
 * stocke : une seule source de verite, pas de table a resynchroniser.
 * 0 etoile -> plancher a 1.
 */
function fragmentRefund(stars: number, starCosts: Map<number, number>): number {
	if (stars <= 0) return ZERO_STAR_REFUND;
	const cost = starCosts.get(stars);
	if (cost === undefined) return ZERO_STAR_REFUND;
	return Math.floor(cost / 2);
}

/**
 * Rendement en bonbons d'une instance sacrifiee : une part de son XP
 * TOTALE (paliers franchis + progression en cours), convertie en
 * bonbons. Les deux coefficients vivent en base (reequilibrables).
 * Arrondi au plancher : on ne cree pas de bonbon a partir de miettes.
 */
function candyRefund(
	totalXp: number,
	refundRate: number,
	candyXpValue: number,
): number {
	if (candyXpValue <= 0) return 0;
	return Math.floor((totalXp * refundRate) / candyXpValue);
}

/** Projette une ligne brute en instance sacrifiable, avec ce qu'elle
 *  rapporterait. Le front affiche ce rendement AVANT la validation. */
function toDecraftable(
	row: DecraftableRow,
	starCosts: Map<number, number>,
	refundRate: number,
	candyXpValue: number,
) {
	return {
		instance_id: row.instance_id,
		pokemon_id: row.pokemon_id,
		name: row.name,
		stars: row.stars,
		level: row.level,
		is_shiny: Boolean(row.is_shiny),
		fragment_value: fragmentRefund(row.stars, starCosts),
		candy_value: candyRefund(Number(row.total_xp), refundRate, candyXpValue),
	};
}

/** Les coefficients de PUISSANCE, lus a chaque appel (un UPDATE en base
 *  prend effet sans redemarrer — meme principe que team).
 *  Cast explicite : game_settings.setting_value est un DECIMAL, que le
 *  driver renvoie en string malgre le type annonce par le model. */
async function loadCoeffs(): Promise<{
	refundRate: number;
	candyXpValue: number;
}> {
	const settings = await findAllSettings();
	return {
		refundRate: Number(settings.decraft_xp_refund_rate ?? 0.25),
		candyXpValue: Number(settings.candy_xp_value ?? 100),
	};
}

/**
 * Etat de l'onglet PUISSANCE (GET /api/pokemon/:instanceId/power).
 * Lecture pure : etoiles actuelles, pot de fragments, cout du prochain
 * palier, et la liste des doublons sacrifiables avec leur rendement.
 */
export async function getPowerState(
	instanceId: number,
	userId: number,
): Promise<PowerState> {
	const [state, rows, coeffs, starCosts] = await Promise.all([
		findStarState(instanceId, userId),
		findDecraftable(instanceId, userId),
		loadCoeffs(),
		findStarCosts(),
	]);

	if (!state) throw new PowerError("NOT_FOUND");

	const nextCost = state.next_star_cost;

	return {
		instance_id: state.instance_id,
		stars: state.stars,
		fragments_owned: state.fragments_owned,
		next_star_cost: nextCost,
		// Au max (5 etoiles) : next_star_cost NULL -> jamais montable.
		can_upgrade: nextCost !== null && state.fragments_owned >= nextCost,
		decraftable: rows.map((r) =>
			toDecraftable(r, starCosts, coeffs.refundRate, coeffs.candyXpValue),
		),
	};
}

/**
 * R2 — Monter une etoile (transaction).
 * Verrou FOR UPDATE sur le pot, refus si deja 5 etoiles (MAX_STARS) ou
 * fragments insuffisants (NOT_ENOUGH_FRAGMENTS), debit puis stars += 1.
 * Renvoie l'etat a jour (lu APRES commit).
 */
export async function upgradeStar(
	instanceId: number,
	userId: number,
): Promise<PowerState> {
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();

		const state = await lockStarStateForUpdate(conn, instanceId, userId);
		if (!state) throw new PowerError("NOT_FOUND");

		// Pas de ligne star_costs pour stars+1 -> deja au maximum.
		if (state.next_star_cost === null) throw new PowerError("MAX_STARS");

		if (state.fragments_owned < state.next_star_cost) {
			throw new PowerError("NOT_ENOUGH_FRAGMENTS");
		}

		await consumeFragments(
			conn,
			userId,
			state.evolution_line_id,
			state.next_star_cost,
		);
		await incrementStar(conn, instanceId);

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}

	return getPowerState(instanceId, userId);
}

/**
 * R1 — Decrafter des doublons (transaction DESTRUCTIVE).
 *
 * Les instances sacrifiees sont SUPPRIMEES definitivement. Leurs items
 * equipes retournent en reserve (FK ON DELETE SET NULL, verifie).
 *
 * Garde-fous : la relecture verrouillee re-applique TOUS les filtres
 * (meme ligne evolutive, au joueur, pas la cible, pas en equipe). Si
 * une seule instance demandee ne passe pas, on refuse TOUT le lot
 * (INVALID_SACRIFICE) : mieux vaut ne rien detruire que detruire a
 * moitie sur une liste que le joueur croyait valide.
 *
 * Renvoie ce qui a ete gagne + l'etat a jour.
 */
export async function decraftInstances(
	targetInstanceId: number,
	instanceIds: number[],
	userId: number,
): Promise<DecraftResult> {
	if (instanceIds.length === 0) throw new PowerError("NOTHING_TO_DECRAFT");

	// Dedoublonnage : un id envoye deux fois ne doit pas compter double.
	const uniqueIds = [...new Set(instanceIds)];

	const [coeffs, starCosts] = await Promise.all([
		loadCoeffs(),
		findStarCosts(),
	]);

	let fragmentsGained = 0;
	let candiesGained = 0;

	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();

		// La cible doit exister (et nous donner sa ligne evolutive).
		const target = await lockStarStateForUpdate(conn, targetInstanceId, userId);
		if (!target) throw new PowerError("NOT_FOUND");

		// Relecture VERROUILLEE avec tous les garde-fous.
		const rows = await lockDecraftablesForUpdate(
			conn,
			uniqueIds,
			targetInstanceId,
			userId,
		);

		// Tout ou rien : une instance manquante = une regle violee
		// (pas au joueur, en equipe, mauvaise ligne, ou la cible).
		if (rows.length !== uniqueIds.length) {
			throw new PowerError("INVALID_SACRIFICE");
		}

		for (const row of rows) {
			fragmentsGained += fragmentRefund(row.stars, starCosts);
			candiesGained += candyRefund(
				Number(row.total_xp),
				coeffs.refundRate,
				coeffs.candyXpValue,
			);
		}

		// Detruire, puis crediter les deux pots.
		await deleteInstances(conn, uniqueIds);
		await addFragments(conn, userId, target.evolution_line_id, fragmentsGained);
		if (candiesGained > 0) {
			await addCandies(conn, userId, candiesGained);
		}

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}

	return {
		sacrificed_count: uniqueIds.length,
		fragments_gained: fragmentsGained,
		candies_gained: candiesGained,
		state: await getPowerState(targetInstanceId, userId),
	};
}

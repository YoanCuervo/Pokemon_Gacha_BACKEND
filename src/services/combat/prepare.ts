// =====================================================================
// services/combat/prepare.ts — Builder d'equipe de combat.
// CombatTeamRow[] (model) -> Fighter[] (state), via R7 + fusion.
// PUR : aucun SQL ici, testable a sec avec des lignes fabriquees.
// =====================================================================

import type { CombatTeamRow } from "../../models/combat.model";
import type { CombatRole, SetupItem, TeamKey } from "../../types/combat";
import { computeStat, type StatCoeffs } from "../stats";
import type { Fighter } from "./state";

/** Rangs de rarete (COMBAT_SPEC 6.1) — constante de service, pas en base. */
const RARITY_RANK: Record<string, number> = {
	common: 1,
	rare: 2,
	ultra_rare: 3,
	legendary: 4,
	mythic: 5,
};

/** Ordre d'affichage des slots d'items dans le setup (contrat v2). */
const CATEGORY_ORDER: Record<string, number> = {
	att: 1,
	def: 2,
	speed: 3,
	spe: 4,
};

/** Une equipe prete au combat : les fighters + l'initiative. */
export interface PreparedTeam {
	user_id: number;
	fighters: Fighter[];
	total_speed: number;
}

/**
 * Construit l'equipe d'une cle ("a" ou "b") depuis les lignes plates.
 *
 * Pipeline (COMBAT_SPEC 3.4) :
 *   base -> x etoiles x niveau + items (R7, via computeStat)
 *        -> fusion ATTAQUE = ATT + SPE / VIE = HP + DEF + SPD
 *
 * Boosts par item (refonte 18/07) : att -> atk, def -> def,
 * speed -> speed, spe -> spe (le boost du spe finit dans l'ATTAQUE,
 * pas de taxe statistique sur les roles). hp et spd : aucun item.
 */
export function prepareTeam(
	key: TeamKey,
	userId: number,
	rows: CombatTeamRow[],
	coeffs: StatCoeffs,
): PreparedTeam {
	// Recoller les lignes plates par slot (meme pattern que groupRows).
	const bySlot = new Map<number, CombatTeamRow[]>();
	for (const row of rows) {
		const existing = bySlot.get(row.slot_position);
		if (existing) {
			existing.push(row);
		} else {
			bySlot.set(row.slot_position, [row]);
		}
	}

	const fighters: Fighter[] = [];
	let totalSpeed = 0;

	for (const [slot, slotRows] of bySlot) {
		const first = slotRows[0];
		if (!first) continue; // impossible en pratique, exige par noUncheckedIndexedAccess

		const boostFor = (category: string) =>
			slotRows
				.filter(
					(r) =>
						r.item_category === category &&
						(r.item_required_type == null ||
							r.item_required_type === first.type_primary ||
							r.item_required_type === first.type_secondary),
				)
				.reduce((sum, r) => sum + (r.item_boost ?? 0), 0);

		// L'item spe : porteur du role (et de sa rarete pour crit/anticrit).
		const speRow = slotRows.find((r) => r.item_category === "spe") ?? null;
		const role: CombatRole = (speRow?.item_mode as CombatRole) ?? "attacker";
		const speRarityRank =
			speRow?.item_rarity != null
				? (RARITY_RANK[speRow.item_rarity] ?? null)
				: null;

		// Items equipes -> setup (contrat v2) : les lignes qui portent un
		// item, projetees en SetupItem, triees att/def/speed/spe.
		// Sur un LEFT JOIN, name/category/rarity sont NULL ensemble ou
		// renseignes ensemble ; le type guard du filter retrecit les trois
		// pour que le map soit type-sur sans `as`.
		const items: SetupItem[] = slotRows
			.filter(
				(
					r,
				): r is CombatTeamRow & {
					item_name: string;
					item_category: NonNullable<CombatTeamRow["item_category"]>;
					item_rarity: NonNullable<CombatTeamRow["item_rarity"]>;
				} =>
					r.item_name !== null &&
					r.item_category !== null &&
					r.item_rarity !== null,
			)
			.map((r) => ({
				category: r.item_category,
				name: r.item_name,
				rarity: r.item_rarity,
			}))
			.sort(
				(i1, i2) =>
					(CATEGORY_ORDER[i1.category] ?? 0) -
					(CATEGORY_ORDER[i2.category] ?? 0),
			);

		// R7 sur les six stats — un seul canal : computeStat.
		const atk = computeStat(
			first.base_atk,
			first.stars,
			first.level,
			boostFor("att"),
			coeffs,
		);
		const spe = computeStat(
			first.base_spe,
			first.stars,
			first.level,
			boostFor("spe"),
			coeffs,
		);
		const hp = computeStat(first.base_hp, first.stars, first.level, 0, coeffs);
		const def = computeStat(
			first.base_def,
			first.stars,
			first.level,
			boostFor("def"),
			coeffs,
		);
		const spd = computeStat(
			first.base_spd,
			first.stars,
			first.level,
			0,
			coeffs,
		);
		const speed = computeStat(
			first.base_speed,
			first.stars,
			first.level,
			boostFor("speed"),
			coeffs,
		);

		totalSpeed += speed;

		const vieMax = hp + def + spd;

		fighters.push({
			uid: `${key}${slot}`,
			slot_position: slot,
			role,
			spe_rarity_rank: speRarityRank,
			attaque: atk + spe,
			vie_max: vieMax,
			vie: vieMax,
			alive: true,
			pokemon_id: first.pokemon_id,
			is_shiny: first.is_shiny,
			type_primary: first.type_primary,
			type_secondary: first.type_secondary,
			stars: first.stars,
			items,
		});
	}

	// Ordre garanti par slot_position (le SQL trie deja, mais le Map ne
	// promet rien de plus que l'ordre d'insertion : on verrouille).
	fighters.sort((f1, f2) => f1.slot_position - f2.slot_position);

	return { user_id: userId, fighters, total_speed: totalSpeed };
}

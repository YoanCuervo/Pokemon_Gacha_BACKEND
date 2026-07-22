import { pool } from "../config/db";
import {
	attachItem,
	clearSlot,
	consumeStones,
	findEvolutionInfo,
	findInstanceById,
	findReserveItemForEquip,
	instanceBelongsToUserTx,
	lockEvolutionForUpdate,
	setInstanceSpecies,
} from "../models/pokemon.model";
import type {
	EquipSlot,
	EvolutionInfo,
	InstanceDetail,
	InstanceRow,
	ItemCategory,
} from "../types";

/** Erreur metier de l'inventaire, mappee en HTTP par le controller. */
export class InventoryError extends Error {
	constructor(
		public code:
			| "NOT_FOUND"
			| "ITEM_NOT_FOUND"
			| "CANNOT_EVOLVE"
			| "NOT_ENOUGH_STONES",
	) {
		super(code);
		this.name = "InventoryError";
	}
}

/** Ordre fige des 4 slots (contrat de la fiche : toujours ces 4, dans cet ordre). */
const SLOT_ORDER: ItemCategory[] = ["att", "def", "speed", "spe"];

/**
 * Assemble les lignes plates en une fiche (PUR, sans SQL, testable a sec).
 * - Une instance sans item -> 1 ligne avec les item_* a NULL.
 * - rows vide (instance introuvable / pas au joueur) -> NOT_FOUND.
 * Les 4 slots sont TOUJOURS presents (vides remplis a null), pour que le front mappe chaque case sans deviner.
 */
function buildDetail(rows: InstanceRow[]): InstanceDetail {
	const first = rows[0];
	if (!first) throw new InventoryError("NOT_FOUND");

	// Index des items equipes par categorie (une seule ligne par categorie,
	// garanti par uq_ii_equip cote DB).
	const byCategory = new Map<ItemCategory, EquipSlot["item"]>();
	for (const row of rows) {
		if (row.item_id !== null && row.item_category !== null) {
			byCategory.set(row.item_category, {
				id: row.item_id,
				name: row.item_name ?? "",
				category: row.item_category,
				required_type: row.item_required_type,
				mode: row.item_mode,
				boost_value: row.item_boost ?? 0,
				rarity: row.item_rarity ?? "common",
			});
		}
	}

	const equipped: EquipSlot[] = SLOT_ORDER.map((category) => ({
		category,
		item: byCategory.get(category) ?? null,
	}));

	return {
		instance: {
			instance_id: first.instance_id,
			pokemon_id: first.pokemon_id,
			name: first.name,
			type_primary: first.type_primary,
			type_secondary: first.type_secondary,
			level: first.level,
			stars: first.stars,
			is_shiny: first.is_shiny,
		},
		equipped,
	};
}

/**
 * Lecture de la fiche d'une instance (GET /api/pokemon/:instanceId).
 * Lecture pure de possession : aucune stat calculee (R7 hors inventaire).
 */
export async function getInstanceDetail(
	instanceId: number,
	userId: number,
): Promise<InstanceDetail> {
	const rows = await findInstanceById(instanceId, userId);
	return buildDetail(rows);
}

/**
 * R5 — Equiper un item sur une instance (remplacement atomique).
 * Le slot cible est la CATEGORIE de l'item (deduit serveur, pas du body).
 * Si le slot est deja occupe, l'occupant retourne en reserve, puis le nouvel item prend sa place — le tout en UNE transaction (sinon on pourrait vider le slot sans le remplir, ou violer uq_ii_equip).
 * Aucune verif de type (required_type) : un item incompatible est equipable, son boost sera juste ignore au combat (decision actee).
 * Renvoie la fiche a jour (lue APRES commit, hors transaction).
 */
export async function equipItem(
	instanceId: number,
	itemInstanceId: number,
	userId: number,
): Promise<InstanceDetail> {
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();

		// 1. L'instance est-elle au joueur ?
		const owns = await instanceBelongsToUserTx(conn, instanceId, userId);
		if (!owns) throw new InventoryError("NOT_FOUND");

		// 2. L'item est-il en reserve, au joueur ? + sa categorie = slot cible.
		const item = await findReserveItemForEquip(conn, itemInstanceId, userId);
		if (!item) throw new InventoryError("ITEM_NOT_FOUND");

		// 3. Liberer le slot (no-op si vide), puis 4. equiper.
		await clearSlot(conn, instanceId, item.category);
		await attachItem(conn, itemInstanceId, instanceId);

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}

	// 5. Relecture APRES commit : etat final des 4 slots.
	const rows = await findInstanceById(instanceId, userId);
	return buildDetail(rows);
}

/**
 * R5 — Desequiper un slot (categorie) d'une instance.
 * Un seul UPDATE (via clearSlot) : pas besoin de transaction. Idempotent : si le slot est deja vide, affectedRows = 0, on ne le traite pas comme une erreur (le monde est deja dans l'etat voulu).
 * Renvoie la fiche a jour.
 */
export async function unequipItem(
	instanceId: number,
	category: ItemCategory,
	userId: number,
): Promise<InstanceDetail> {
	const conn = await pool.getConnection();
	try {
		// Propriete : l'instance est-elle au joueur ?
		const owns = await instanceBelongsToUserTx(conn, instanceId, userId);
		if (!owns) throw new InventoryError("NOT_FOUND");

		// Vide le slot (no-op si deja vide, on ignore affectedRows).
		await clearSlot(conn, instanceId, category);
	} finally {
		conn.release();
	}

	const rows = await findInstanceById(instanceId, userId);
	return buildDetail(rows);
}

// ---------------------------------------------------------------------
// EVOLUTION (onglet A) — R3 + evolution des shiny
// ---------------------------------------------------------------------

/** La ligne brute du model : les deux pierres possibles + le multiplicateur.
 *  (Type local : reflete EvolutionInfoRowPacket du model. On ne l'exporte
 *  pas, c'est un detail d'implementation entre model et service.) */
interface EvolutionRow {
	instance_id: number;
	is_shiny: number | boolean;
	current_pokemon_id: number;
	current_name: string;
	target_pokemon_id: number | null;
	target_name: string | null;
	normal_stone_id: number | null;
	normal_stone_name: string | null;
	normal_stone_type: string | null;
	base_cost: number | null;
	normal_owned: number;
	shiny_stone_id: number | null;
	shiny_stone_name: string | null;
	shiny_owned: number;
	shiny_multiplier: string | null;
}

/** Le verdict d'evolution, calcule a partir du row brut.
 *  PUR (pas de SQL) : c'est LA regle qui tranche normal vs shiny.
 *  Partage par le GET (affichage) et le POST (execution) pour qu'ils
 *  ne divergent jamais. Renvoie la pierre REQUISE, le cout EFFECTIF,
 *  la quantite possedee de cette pierre, et si l'evolution est possible.
 *  - Stade final (pas de cible) -> stone null, can_evolve false.
 *  - Shiny -> Shiny Stone, cout = base * multiplicateur.
 *  - Normal -> pierre du type, cout = base. */
function resolveEvolution(row: EvolutionRow): {
	isShiny: boolean;
	hasTarget: boolean;
	stone: { id: number; name: string; type: string } | null;
	stoneCost: number | null;
	stonesOwned: number;
	stoneIdToConsume: number | null;
	canEvolve: boolean;
} {
	// Le driver peut renvoyer 1 (TINYINT) ou true (BOOLEAN) selon la config.
	const isShiny = Boolean(row.is_shiny);
	const hasTarget = row.target_pokemon_id !== null;

	// Stade final : rien a evoluer, quel que soit le reste.
	if (!hasTarget) {
		return {
			isShiny,
			hasTarget: false,
			stone: null,
			stoneCost: null,
			stonesOwned: isShiny ? row.shiny_owned : row.normal_owned,
			stoneIdToConsume: null,
			canEvolve: false,
		};
	}

	const multiplier = Number(row.shiny_multiplier ?? 1);

	if (isShiny) {
		// Evolution shiny : Shiny Stone, cout = base * multiplicateur.
		// La Shiny Stone doit exister (seed 005). Si elle manque
		// (shiny_stone_id null), on ne peut pas evoluer -> can_evolve false.
		const cost = row.base_cost !== null ? row.base_cost * multiplier : null;
		const owned = row.shiny_owned;
		const canEvolve =
			row.shiny_stone_id !== null && cost !== null && cost > 0 && owned >= cost;
		return {
			isShiny: true,
			hasTarget: true,
			stone:
				row.shiny_stone_id !== null
					? {
							id: row.shiny_stone_id,
							name: row.shiny_stone_name ?? "",
							type: "shiny",
						}
					: null,
			stoneCost: cost,
			stonesOwned: owned,
			stoneIdToConsume: row.shiny_stone_id,
			canEvolve,
		};
	}

	// Evolution normale : pierre du type, cout de base.
	const cost = row.base_cost;
	const owned = row.normal_owned;
	const canEvolve =
		row.normal_stone_id !== null && cost !== null && cost > 0 && owned >= cost;
	return {
		isShiny: false,
		hasTarget: true,
		stone:
			row.normal_stone_id !== null
				? {
						id: row.normal_stone_id,
						name: row.normal_stone_name ?? "",
						type: row.normal_stone_type ?? "",
					}
				: null,
		stoneCost: cost,
		stonesOwned: owned,
		stoneIdToConsume: row.normal_stone_id,
		canEvolve,
	};
}

/**
 * Info d'evolution d'une instance (GET /api/pokemon/:instanceId/evolution).
 * Lecture pure. Le service tranche normal/shiny via resolveEvolution et
 * renvoie la pierre requise deja choisie + le cout effectif.
 */
export async function getEvolutionInfo(
	instanceId: number,
	userId: number,
): Promise<EvolutionInfo> {
	const row = await findEvolutionInfo(instanceId, userId);
	if (!row) throw new InventoryError("NOT_FOUND");

	const r = resolveEvolution(row as unknown as EvolutionRow);

	return {
		instance_id: row.instance_id,
		current: { pokemon_id: row.current_pokemon_id, name: row.current_name },
		target: r.hasTarget
			? {
					pokemon_id: row.target_pokemon_id as number,
					name: row.target_name ?? "",
				}
			: null,
		stone: r.stone,
		stone_cost: r.stoneCost,
		stones_owned: r.stonesOwned,
		is_shiny_evolution: r.isShiny && r.hasTarget,
		can_evolve: r.canEvolve,
	};
}

/**
 * R3 — Evolution d'espece (transaction), normale ou shiny.
 * Verrou FOR UPDATE sur les lignes user_stones des deux pierres, refus
 * si stade final (CANNOT_EVOLVE) ou pierres insuffisantes
 * (NOT_ENOUGH_STONES), decrement de la BONNE pierre, changement de
 * pokemon_id. resolveEvolution (partage avec le GET) tranche quelle
 * pierre et quel cout.
 * CONSERVES mecaniquement : stars, star_progress, level, xp, is_shiny,
 * items equipes. Un shiny reste shiny.
 * Renvoie la fiche a jour (lue APRES commit, comme equip/unequip).
 */
export async function evolveInstance(
	instanceId: number,
	userId: number,
): Promise<InstanceDetail> {
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();

		// 1. Propriete.
		const owns = await instanceBelongsToUserTx(conn, instanceId, userId);
		if (!owns) throw new InventoryError("NOT_FOUND");

		// 2. Lecture verrouillee (les deux pierres du joueur + le multiplicateur).
		const row = await lockEvolutionForUpdate(conn, instanceId, userId);
		if (!row) throw new InventoryError("NOT_FOUND");

		// 3. Meme regle que le GET : quelle pierre, quel cout, evoluable ?
		const r = resolveEvolution(row as unknown as EvolutionRow);

		// 4. Stade final : pas de cible.
		if (!r.hasTarget) throw new InventoryError("CANNOT_EVOLVE");

		// 5. Pierres insuffisantes (couvre aussi Shiny Stone manquante /
		//    cout invalide : stoneIdToConsume ou stoneCost null).
		if (!r.canEvolve || r.stoneIdToConsume === null || r.stoneCost === null) {
			throw new InventoryError("NOT_ENOUGH_STONES");
		}

		// 6. Consommer la BONNE pierre, puis muter l'espece.
		await consumeStones(conn, userId, r.stoneIdToConsume, r.stoneCost);
		await setInstanceSpecies(conn, instanceId, row.target_pokemon_id as number);

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}

	// 7. Relecture APRES commit : fiche a jour (nouvelle espece, items conserves).
	const rows = await findInstanceById(instanceId, userId);
	return buildDetail(rows);
}

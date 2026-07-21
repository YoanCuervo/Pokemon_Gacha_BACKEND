import { pool } from "../config/db";
import {
	attachItem,
	clearSlot,
	findInstanceById,
	findReserveItemForEquip,
	instanceBelongsToUserTx,
} from "../models/pokemon.model";
import type {
	EquipSlot,
	InstanceDetail,
	InstanceRow,
	ItemCategory,
} from "../types";

/** Erreur metier de l'inventaire, mappee en HTTP par le controller. */
export class InventoryError extends Error {
	constructor(public code: "NOT_FOUND" | "ITEM_NOT_FOUND") {
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
 * Les 4 slots sont TOUJOURS presents (vides remplis a null), pour que
 * le front mappe chaque case sans deviner.
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
 *
 * Le slot cible est la CATEGORIE de l'item (deduit serveur, pas du body).
 * Si le slot est deja occupe, l'occupant retourne en reserve, puis le
 * nouvel item prend sa place — le tout en UNE transaction (sinon on
 * pourrait vider le slot sans le remplir, ou violer uq_ii_equip).
 *
 * Aucune verif de type (required_type) : un item incompatible est
 * equipable, son boost sera juste ignore au combat (decision actee).
 *
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

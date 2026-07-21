import { findInstanceById } from "../models/pokemon.model";
import type {
	EquipSlot,
	InstanceDetail,
	InstanceRow,
	ItemCategory,
} from "../types";

/** Erreur metier de l'inventaire, mappee en HTTP par le controller. */
export class InventoryError extends Error {
	constructor(public code: "NOT_FOUND") {
		super(code);
		this.name = "InventoryError";
	}
}

/** Ordre fige des 4 slots (contrat de la fiche : toujours ces 4, dans cet ordre). */
const SLOT_ORDER: ItemCategory[] = ["att", "def", "speed", "spe"];

/**
 * Assemble les lignes plates en une fiche.
 * - Une instance sans item -> 1 ligne avec les item_* a NULL.
 * - Une instance introuvable / pas au joueur -> [] -> NOT_FOUND.
 * Les 4 slots sont TOUJOURS presents (vides remplis a null), pour que
 * le front mappe chaque case sans deviner.
 */
export async function getInstanceDetail(
	instanceId: number,
	userId: number,
): Promise<InstanceDetail> {
	const rows: InstanceRow[] = await findInstanceById(instanceId, userId);

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

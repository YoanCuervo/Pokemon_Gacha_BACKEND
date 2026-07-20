// =====================================================================
// services/combat/state.ts — État interne du moteur de combat
// Le moteur travaille sur ces structures ; le log (types/combat.ts)
// n'en est que la projection. Aucun accès DB ici : tout est pur.
// =====================================================================

import type {
	CombatEvent,
	CombatRole,
	CombatUid,
	SetupItem,
	TeamKey,
} from "../../types/combat";

// ---------------------------------------------------------------------
// Fighter — un pokémon en combat.
// Seuls `vie` et `alive` sont mutables. Un mort est MARQUÉ, jamais
// retiré du tableau (§1 : log + futur revive gratuits).
// ---------------------------------------------------------------------

export interface Fighter {
	uid: CombatUid; // "a1"..."b6"
	slot_position: number; // 1-6

	// Comportement
	role: CombatRole;
	/** Rang de rareté de l'item spe (common=1 ... mythic=5).
	 *  null si slot spe vide. Sert au calcul crit/anticrit (§6.3) —
	 *  le log ne le porte pas, le moteur en a besoin. */
	spe_rarity_rank: number | null;

	// Stats de combat (figées au départ, §3.3)
	attaque: number; // ATT + SPE
	vie_max: number; // HP + DEF + SPD — cap de soin

	// Les DEUX seules valeurs mutables du combat
	vie: number; // démarre à vie_max
	alive: boolean;

	// Affichage — uniquement pour émettre le setup
	pokemon_id: number;
	is_shiny: boolean;
	type_primary: string;
	type_secondary: string | null;
	stars: number;
	items: SetupItem[];
}

// ---------------------------------------------------------------------
// CombatState — l'état complet manipulé par la boucle.
// ---------------------------------------------------------------------

export interface CombatState {
	/** Composition immuable : ordre = slot_position, jamais de retrait. */
	teams: { a: Fighter[]; b: Fighter[] };
	/** Index (dans le tableau COMPLET) du prochain à agir, par équipe. */
	cursors: { a: number; b: number };
	/** Compteur global du garde-fou anti-boucle (§10). */
	actions: number;
	/** Le log en construction. */
	events: CombatEvent[];
	/** Prochain numéro de séquence d'événement. */
	seq: number;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** Les vivants d'une équipe, dans l'ordre des slots. */
export function living(team: Fighter[]): Fighter[] {
	return team.filter((f) => f.alive);
}

/** L'équipe adverse. */
export function opposing(key: TeamKey): TeamKey {
	return key === "a" ? "b" : "a";
}

/**
 * Adjacence — définition unique (§8.1) : les voisins VIVANTS les plus
 * proches, calculés sur la liste des vivants, pas sur les slots fixes.
 * Retourne 0, 1 ou 2 voisins. Partagée par heal_adjacent et atk_adjacent.
 */
export function getAdjacent(team: Fighter[], source: Fighter): Fighter[] {
	const alive = living(team);
	const i = alive.findIndex((f) => f.uid === source.uid);
	if (i === -1) return []; // source morte : pas de voisins
	const out: Fighter[] = [];
	const left = alive[i - 1];
	const right = alive[i + 1];
	if (left) out.push(left);
	if (right) out.push(right);
	return out;
}

/**
 * Avance le curseur d'une équipe : index du prochain VIVANT à partir de
 * `from` (inclus), en rebouclant. Retourne -1 si l'équipe est morte.
 * Le curseur vit dans le tableau complet — les morts sont sautés ici,
 * pas retirés.
 */
export function nextLivingIndex(team: Fighter[], from: number): number {
	const n = team.length;
	if (n === 0) return -1;
	for (let step = 0; step < n; step++) {
		const i = (from + step) % n;
		const f = team[i];
		if (f?.alive) return i;
	}
	return -1;
}

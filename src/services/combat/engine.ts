// =====================================================================
// services/combat/engine.ts — Le moteur de combat.
// Fonction PURE : deux equipes preparees + settings (+ rng) -> CombatLog.
// Aucun SQL, aucun HTTP. Reference : COMBAT_SPEC.md.
// =====================================================================

import type {
	CombatEvent,
	CombatLog,
	HealApplied,
	Hit,
	TeamKey,
} from "../../types/combat";
import type { PreparedTeam } from "./prepare";
import {
	type CombatState,
	type Fighter,
	getAdjacent,
	living,
	nextLivingIndex,
	opposing,
} from "./state";

/** Cles de game_settings necessaires au combat (COMBAT_SPEC 12). */
export interface CombatSettings {
	crit_chance_step: number; // 0.05
	crit_multiplier: number; // 1.5
	max_actions: number; // 1000
}

/** Generateur aleatoire injectable : Math.random en prod, truque en test. */
export type Rng = () => number;

const HEAL_ROLES = new Set([
	"heal_left",
	"heal_right",
	"heal_random",
	"heal_lowest",
	"heal_adjacent",
	"heal_all",
]);

// ---------------------------------------------------------------------
// resolveCombat — l'unique export d'usage.
// ---------------------------------------------------------------------

export function resolveCombat(
	teamA: PreparedTeam,
	teamB: PreparedTeam,
	settings: CombatSettings,
	rng: Rng = Math.random,
): CombatLog {
	const state: CombatState = {
		teams: { a: teamA.fighters, b: teamB.fighters },
		cursors: { a: 0, b: 0 },
		actions: 0,
		events: [],
		seq: 0,
	};

	// --- Initiative (§4.1) : plus grand total_speed, egalite -> coinflip.
	let first: TeamKey;
	let coinflip = false;
	if (teamA.total_speed > teamB.total_speed) {
		first = "a";
	} else if (teamB.total_speed > teamA.total_speed) {
		first = "b";
	} else {
		first = rng() < 0.5 ? "a" : "b";
		coinflip = true;
	}

	emitSetup(state, teamA, teamB, first);
	if (coinflip) {
		push(state, { type: "coinflip", winner: first });
	}

	// --- La boucle : alternance stricte, verification apres CHAQUE action.
	let current: TeamKey = first;
	let result: TeamKey | "draw" | null = null;

	while (result === null) {
		// Garde-fou anti-boucle (§10) — verifie AVANT d'agir.
		if (state.actions >= settings.max_actions) {
			result = "draw";
			break;
		}

		const acted = act(state, current, settings, rng);
		if (acted) state.actions++;

		// Une equipe morte ? (l'action de l'un peut tuer le dernier de l'autre,
		// voire les deux camps sur une mort mutuelle : priorite au camp adverse
		// mort = l'attaquant gagne s'il emporte l'autre avec lui... sauf s'il
		// etait le dernier des deux cotes -> l'equipe qui vient d'agir gagne).
		const aDead = living(state.teams.a).length === 0;
		const bDead = living(state.teams.b).length === 0;
		if (aDead && bDead) {
			result = current; // mort mutuelle totale : le camp actif l'emporte
		} else if (aDead) {
			result = "b";
		} else if (bDead) {
			result = "a";
		} else {
			current = opposing(current);
		}
	}

	push(state, { type: "end", result, actions: state.actions });

	return { version: 1, events: state.events };
}

// ---------------------------------------------------------------------
// Emission du log
// ---------------------------------------------------------------------

/** Omit distribue sur chaque membre d'une union — l'Omit natif applique
 *  a une union ne garde que les cles COMMUNES aux membres (piege
 *  classique) ; le `T extends unknown` force TS a traiter chaque membre
 *  separement. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown
	? Omit<T, K>
	: never;

/** Pousse un evenement en lui attribuant son seq. */
function push(
	state: CombatState,
	event: DistributiveOmit<CombatEvent, "seq">,
): void {
	state.events.push({ ...event, seq: state.seq++ } as CombatEvent);
}

function emitSetup(
	state: CombatState,
	teamA: PreparedTeam,
	teamB: PreparedTeam,
	first: TeamKey,
): void {
	const memberOf = (f: Fighter) => ({
		uid: f.uid,
		slot_position: f.slot_position,
		pokemon_id: f.pokemon_id,
		is_shiny: f.is_shiny,
		type_primary: f.type_primary,
		type_secondary: f.type_secondary,
		role: f.role,
		attaque: f.attaque,
		vie_max: f.vie_max,
	});

	push(state, {
		type: "setup",
		teams: {
			a: {
				user_id: teamA.user_id,
				total_speed: teamA.total_speed,
				members: teamA.fighters.map(memberOf),
			},
			b: {
				user_id: teamB.user_id,
				total_speed: teamB.total_speed,
				members: teamB.fighters.map(memberOf),
			},
		},
		first,
	});
}

// ---------------------------------------------------------------------
// act — UNE action du pokemon sous le curseur de l'equipe donnee.
// Retourne false si l'equipe n'a plus de vivant (ne devrait pas arriver,
// la boucle verifie — mais un moteur qui ne plante jamais vaut mieux).
// ---------------------------------------------------------------------

function act(
	state: CombatState,
	key: TeamKey,
	settings: CombatSettings,
	rng: Rng,
): boolean {
	const team = state.teams[key];
	const idx = nextLivingIndex(team, state.cursors[key]);
	if (idx === -1) return false;

	const actor = team[idx];
	if (!actor) return false; // noUncheckedIndexedAccess

	// Le curseur avance APRES la designation : prochain appel = suivant.
	state.cursors[key] = (idx + 1) % team.length;

	if (HEAL_ROLES.has(actor.role)) {
		const targets = pickHealTargets(state, key, actor, rng);
		if (targets.length > 0) {
			doHeal(state, actor, targets);
			return true;
		}
		// Fallback (§6.4) : personne a soigner -> attaque normale.
	}

	doAttack(state, key, actor, settings, rng);
	return true;
}

// ---------------------------------------------------------------------
// Ciblage (§7)
// ---------------------------------------------------------------------

/** Tirage uniforme dans une liste non vide. */
function pickRandom<T>(list: T[], rng: Rng): T {
	const item = list[Math.floor(rng() * list.length)];
	// list.length > 0 garanti par les appelants ; le ?? apaise TS sans mentir.
	return item ?? (list[0] as T);
}

/** Cible d'attaque : random parmi les taunts vivants, sinon random global. */
function pickTarget(
	state: CombatState,
	attackerKey: TeamKey,
	rng: Rng,
): Fighter {
	const enemies = living(state.teams[opposing(attackerKey)]);
	const taunts = enemies.filter((f) => f.role === "taunt");
	return pickRandom(taunts.length > 0 ? taunts : enemies, rng);
}

// ---------------------------------------------------------------------
// L'echange (§5)
// ---------------------------------------------------------------------

/** Chance de crit de l'attaquant contre cette cible (§6.3). */
function critChance(
	attacker: Fighter,
	target: Fighter,
	settings: CombatSettings,
): number {
	if (attacker.role !== "crit" || attacker.spe_rarity_rank === null) return 0;
	const base = settings.crit_chance_step * attacker.spe_rarity_rank;
	const anti =
		target.role === "anticrit" && target.spe_rarity_rank !== null
			? settings.crit_chance_step * target.spe_rarity_rank
			: 0;
	return Math.max(0, base - anti);
}

function doAttack(
	state: CombatState,
	attackerKey: TeamKey,
	attacker: Fighter,
	settings: CombatSettings,
	rng: Rng,
): void {
	const target = pickTarget(state, attackerKey, rng);

	const crit = rng() < critChance(attacker, target, settings);
	const damage = crit
		? Math.round(attacker.attaque * settings.crit_multiplier)
		: attacker.attaque;

	// Les victimes de la frappe active : cible, puis voisins si atk_adjacent.
	const victims: Fighter[] = [target];
	if (attacker.role === "atk_adjacent") {
		victims.push(...getAdjacent(state.teams[opposing(attackerKey)], target));
	}

	// SIMULTANE (§5) : on fige la riposte AVANT d'appliquer quoi que ce soit
	// (la cible riposte meme si elle meurt de la frappe), puis on applique
	// tout, puis on constate les morts.
	const hits: Hit[] = victims.map((v) => ({
		uid: v.uid,
		amount: damage,
		vie_avant: v.vie,
		vie_apres: v.vie - damage,
	}));
	const riposte: Hit = {
		uid: attacker.uid,
		amount: target.attaque, // riposte NUE : brute, jamais de crit
		vie_avant: attacker.vie,
		vie_apres: attacker.vie - target.attaque,
	};

	for (const v of victims) v.vie -= damage;
	attacker.vie -= target.attaque;

	push(state, {
		type: "attack",
		actor: attacker.uid,
		target: target.uid,
		crit,
		hits,
		riposte,
	});

	// Morts, dans l'ordre acte : cible, puis voisins (ordre des hits),
	// puis l'attaquant s'il meurt de la riposte.
	for (const v of victims) markDeath(state, v);
	markDeath(state, attacker);
}

function markDeath(state: CombatState, f: Fighter): void {
	if (!f.alive || f.vie > 0) return;
	f.alive = false; // marque, jamais supprime (§8.2)
	push(state, { type: "death", uid: f.uid });
}

// ---------------------------------------------------------------------
// Le soin (§6.4)
// ---------------------------------------------------------------------

/**
 * Cibles de soin selon le mode. Retourne [] si le mode ne trouve
 * personne de BLESSE -> l'appelant bascule en attaque (fallback).
 * "Allie" inclut le soigneur lui-meme pour heal_random / heal_lowest ;
 * l'adjacence (left/right/adjacent) l'exclut par construction.
 */
function pickHealTargets(
	state: CombatState,
	key: TeamKey,
	healer: Fighter,
	rng: Rng,
): Fighter[] {
	const team = state.teams[key];
	const injured = (f: Fighter) => f.vie < f.vie_max;
	const alive = living(team);
	const adj = getAdjacent(team, healer);
	const idx = alive.findIndex((f) => f.uid === healer.uid);

	switch (healer.role) {
		case "heal_left": {
			const left = alive[idx - 1];
			return left && injured(left) ? [left] : [];
		}
		case "heal_right": {
			const right = alive[idx + 1];
			return right && injured(right) ? [right] : [];
		}
		case "heal_adjacent":
			return adj.filter(injured);
		case "heal_random": {
			const pool = alive.filter(injured);
			return pool.length > 0 ? [pickRandom(pool, rng)] : [];
		}
		case "heal_lowest": {
			const pool = alive.filter(injured);
			if (pool.length === 0) return [];
			return [pool.reduce((lowest, f) => (f.vie < lowest.vie ? f : lowest))];
		}
		case "heal_all":
			return alive.filter(injured);
		default:
			return [];
	}
}

function doHeal(state: CombatState, healer: Fighter, targets: Fighter[]): void {
	const applied: HealApplied[] = targets.map((t) => {
		const before = t.vie;
		const after = Math.min(t.vie + healer.attaque, t.vie_max); // cap (§6.4)
		t.vie = after;
		return {
			uid: t.uid,
			amount: after - before, // le soin REELLEMENT recu
			vie_avant: before,
			vie_apres: after,
		};
	});

	push(state, { type: "heal", actor: healer.uid, targets: applied });
	// Jamais de riposte, jamais de mort sur un soin (§5).
}

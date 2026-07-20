// =====================================================================
// scripts/combat-dry-run.ts — Premier combat a sec, sans base ni HTTP.
// Fabrique deux equipes en passant par prepareTeam (le builder est
// teste au passage), resout, affiche le log.
//
// Lancement : npx tsx src/scripts/combat-dry-run.ts
// (ou ton runner habituel : ts-node, etc.)
// =====================================================================

import type { CombatTeamRow } from "../models/combat.model";
import { type CombatContext, resolveCombat } from "../services/combat/engine";
import { prepareTeam } from "../services/combat/prepare";
import type { StatCoeffs } from "../services/stats";

// --- Reglages identiques a game_settings -----------------------------
const coeffs: StatCoeffs = { star: 0.1, level: 0.02 };
const settings = {
	crit_chance_step: 0.05,
	crit_multiplier: 1.5,
	max_actions: 1000,
};

// --- Contexte (contrat v2) : habillage du setup, valeurs de test -----
const context: CombatContext = {
	arena: "stadium",
	profiles: {
		a: { display_name: "Nerub", avatar_url: null },
		b: { display_name: "Rival", avatar_url: null },
	},
};

// --- Fabrique de lignes (les champs qui ne varient pas sont regroupes)
let nextInstanceId = 1;
function row(
	slot: number,
	name: { pokemon_id: number; type: string },
	stats: [number, number, number, number, number, number], // atk, spe, hp, def, spd, speed
	stars = 1,
	level = 1,
	item?: {
		name?: string;
		category: "att" | "def" | "speed" | "spe";
		mode?: string;
		rarity?: CombatTeamRow["item_rarity"];
		boost?: number;
	},
): CombatTeamRow {
	const [base_atk, base_spe, base_hp, base_def, base_spd, base_speed] = stats;
	return {
		slot_position: slot,
		instance_id: nextInstanceId++,
		pokemon_id: name.pokemon_id,
		is_shiny: false,
		type_primary: name.type,
		type_secondary: null,
		stars,
		level,
		base_atk,
		base_spe,
		base_hp,
		base_def,
		base_spd,
		base_speed,
		item_name: item ? (item.name ?? "Test Item") : null,
		item_category: item?.category ?? null,
		item_mode: item?.mode ?? null,
		item_rarity: item?.rarity ?? null,
		item_required_type: null,
		item_boost: item?.boost ?? null,
	};
}

// Stats de base du seed : Charizard, Blastoise, Venusaur, et les starters.
const CHARIZARD = { pokemon_id: 6, type: "fire" };
const BLASTOISE = { pokemon_id: 9, type: "water" };
const VENUSAUR = { pokemon_id: 3, type: "grass" };
const CHARMANDER = { pokemon_id: 4, type: "fire" };
const SQUIRTLE = { pokemon_id: 7, type: "water" };
const BULBASAUR = { pokemon_id: 1, type: "grass" };

// --- Equipe A : le carry Charizard + un taunt + un healer ------------
const teamA = prepareTeam(
	"a",
	1,
	[
		row(1, CHARIZARD, [84, 109, 78, 78, 85, 100], 5, 41), // le carry du seed
		row(2, BLASTOISE, [83, 85, 79, 100, 105, 78], 4, 28, {
			name: "Focus Sash",
			category: "spe",
			mode: "taunt",
			rarity: "rare",
			boost: 10,
		}),
		row(3, VENUSAUR, [82, 100, 80, 83, 100, 80], 3, 20, {
			name: "Life Orb",
			category: "spe",
			mode: "heal_lowest",
			rarity: "rare",
			boost: 10,
		}),
	],
	coeffs,
);

// --- Equipe B : trois starters avec un crit ---------------------------
const teamB = prepareTeam(
	"b",
	2,
	[
		row(1, CHARMANDER, [52, 60, 39, 43, 50, 65], 3, 22, {
			name: "Scope Lens",
			category: "spe",
			mode: "crit",
			rarity: "mythic", // 25 % de crit : on veut le VOIR sortir
			boost: 20,
		}),
		row(2, SQUIRTLE, [48, 50, 44, 65, 64, 43], 2, 10),
		row(3, BULBASAUR, [49, 65, 45, 49, 65, 45], 4, 30),
	],
	coeffs,
);

// --- Resolution -------------------------------------------------------
// Rng seede maison (mulberry32) : deux lancements = le MEME combat.
// Change la graine pour voir d'autres combats.
function mulberry32(seed: number) {
	let s = seed;
	return () => {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const log = resolveCombat(teamA, teamB, settings, context, mulberry32(42));

// --- Affichage --------------------------------------------------------
console.log(JSON.stringify(log, null, 2));

const last = log.events[log.events.length - 1];
console.log("\n=== RESUME ===");
console.log(`evenements : ${log.events.length}`);
if (last && last.type === "end") {
	console.log(`resultat   : ${last.result} en ${last.actions} actions`);
}

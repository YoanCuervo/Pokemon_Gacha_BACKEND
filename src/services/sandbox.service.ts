import type { CombatTeamRow } from "../models/combat.model";
import {
	findItemTemplatesByIds,
	findSpeciesByIds,
	type ItemTemplateRow,
	type SpeciesRow,
} from "../models/sandbox.model";
import { findAllSettings } from "../models/settings.model";
import type {
	CombatLog,
	SandboxPayload,
	SandboxTeam,
	TeamKey,
	TeamProfile,
} from "../types/combat";
import {
	type CombatContext,
	type CombatSettings,
	resolveCombat,
} from "./combat/engine";
import { prepareTeam } from "./combat/prepare";
import type { StatCoeffs } from "./stats";

/**
 * SERVICE — bac a sable (theorycrafting).
 *
 * Le joueur compose LES DEUX equipes librement. Rien n'est lu ni ecrit
 * dans pokemon_instances : on fabrique des CombatTeamRow[] en memoire
 * a partir des deux catalogues, puis on passe la main a la chaine
 * existante (prepareTeam -> resolveCombat). Le moteur ne sait pas d'ou
 * viennent ses equipes — c'est ce qui rend ce mode possible sans le
 * toucher.
 *
 * Les contraintes du jeu reel sont RESPECTEES (6 max, 1 item par
 * categorie, bornes de niveau/etoiles) : le bac a sable sert a preparer
 * des compos jouables, pas a tester l'impossible.
 */

export class SandboxError extends Error {
	constructor(
		message: string,
		public readonly code:
			| "EMPTY_TEAM"
			| "TEAM_TOO_LARGE"
			| "UNKNOWN_SPECIES"
			| "UNKNOWN_ITEM"
			| "DUPLICATE_CATEGORY"
			| "INVALID_LEVEL"
			| "INVALID_STARS"
			| "TOO_MANY_ITEMS",
	) {
		super(message);
		this.name = "SandboxError";
	}
}

/** Format du jeu (COMBAT_SPEC 2). Duplique TEAM_SIZE de team.service :
 *  meme assumption, la constante fait foi. */
const TEAM_SIZE = 6;

/** Bornes du jeu reel. Le niveau max vient du bareme (level_costs) mais
 *  on ne va pas lire 500 lignes pour valider un entier : la borne est
 *  ici, a synchroniser si la courbe s'etend. */
const MAX_LEVEL = 500;
const MAX_STARS = 5;

/** Un pokemon ne porte qu'un item par categorie (4 slots). */
const MAX_ITEMS = 4;

/**
 * Valide une equipe et rassemble les ids a resoudre.
 * PUR : aucune I/O, on ne fait que verifier la FORME et les BORNES.
 * Les ids sont valides plus tard, contre les catalogues.
 */
function collectIds(
	team: SandboxTeam,
	label: string,
): {
	pokemonIds: number[];
	templateIds: number[];
} {
	if (team.members.length === 0) {
		throw new SandboxError(`L'equipe ${label} est vide`, "EMPTY_TEAM");
	}
	if (team.members.length > TEAM_SIZE) {
		throw new SandboxError(
			`L'equipe ${label} depasse ${TEAM_SIZE} pokemon`,
			"TEAM_TOO_LARGE",
		);
	}

	const pokemonIds: number[] = [];
	const templateIds: number[] = [];

	for (const m of team.members) {
		if (!Number.isInteger(m.level) || m.level < 1 || m.level > MAX_LEVEL) {
			throw new SandboxError(
				`Niveau invalide dans l'equipe ${label} (1-${MAX_LEVEL})`,
				"INVALID_LEVEL",
			);
		}
		if (!Number.isInteger(m.stars) || m.stars < 1 || m.stars > MAX_STARS) {
			throw new SandboxError(
				`Etoiles invalides dans l'equipe ${label} (1-${MAX_STARS})`,
				"INVALID_STARS",
			);
		}
		if (m.item_template_ids.length > MAX_ITEMS) {
			throw new SandboxError(
				`Trop d'items sur un pokemon de l'equipe ${label}`,
				"TOO_MANY_ITEMS",
			);
		}

		pokemonIds.push(m.pokemon_id);
		templateIds.push(...m.item_template_ids);
	}

	return { pokemonIds, templateIds };
}

/**
 * Assemble les lignes plates attendues par prepareTeam.
 *
 * Le format est celui de findCombatTeamByUserId : UNE ligne par couple
 * (pokemon, item). Un pokemon sans item produit UNE ligne avec les
 * item_* a NULL — exactement ce que fait le LEFT JOIN du model reel.
 * prepareTeam recolle ensuite par slot_position.
 *
 * instance_id : les instances n'existent pas ici. On donne l'index du
 * slot — prepareTeam ne s'en sert pas (le uid vient de key+slot), mais
 * le type l'exige.
 */
function buildRows(
	team: SandboxTeam,
	species: Map<number, SpeciesRow>,
	templates: Map<number, ItemTemplateRow>,
	label: string,
): CombatTeamRow[] {
	const rows: CombatTeamRow[] = [];

	team.members.forEach((member, index) => {
		const sp = species.get(member.pokemon_id);
		if (!sp) {
			throw new SandboxError(
				`Espece inconnue (#${member.pokemon_id}) dans l'equipe ${label}`,
				"UNKNOWN_SPECIES",
			);
		}

		const slot = index + 1;

		// Base commune a toutes les lignes de ce pokemon.
		const base = {
			slot_position: slot,
			instance_id: slot, // pas d'instance reelle : valeur de forme
			pokemon_id: sp.pokemon_id,
			is_shiny: member.is_shiny,
			type_primary: sp.type_primary,
			type_secondary: sp.type_secondary,
			stars: member.stars,
			level: member.level,
			base_atk: sp.base_atk,
			base_spe: sp.base_spe,
			base_hp: sp.base_hp,
			base_def: sp.base_def,
			base_spd: sp.base_spd,
			base_speed: sp.base_speed,
		};

		// Un pokemon sans item : UNE ligne, item_* a NULL (comme le LEFT JOIN).
		if (member.item_template_ids.length === 0) {
			rows.push({
				...base,
				item_name: null,
				item_category: null,
				item_required_type: null,
				item_mode: null,
				item_rarity: null,
				item_boost: null,
			});
			return;
		}

		// Une categorie ne peut porter qu'UN item : sinon prepareTeam
		// sommerait les boosts (boostFor filtre par categorie), ce qui
		// n'existe pas en jeu reel — uq_ii_equip l'interdit en base.
		const seen = new Set<string>();

		for (const templateId of member.item_template_ids) {
			const tpl = templates.get(templateId);
			if (!tpl) {
				throw new SandboxError(
					`Item inconnu (#${templateId}) dans l'equipe ${label}`,
					"UNKNOWN_ITEM",
				);
			}
			if (seen.has(tpl.category)) {
				throw new SandboxError(
					`Deux items ${tpl.category} sur le meme pokemon (equipe ${label})`,
					"DUPLICATE_CATEGORY",
				);
			}
			seen.add(tpl.category);

			rows.push({
				...base,
				item_name: tpl.name,
				item_category: tpl.category,
				item_required_type: tpl.required_type,
				item_mode: tpl.mode,
				item_rarity: tpl.rarity,
				item_boost: tpl.boost_value,
			});
		}
	});

	return rows;
}

/**
 * Resout un combat de bac a sable.
 * Aucune ecriture, aucun userId : les deux equipes sont anonymes.
 */
export async function runSandboxCombat(
	payload: SandboxPayload,
): Promise<CombatLog> {
	// 1. Valider la forme et rassembler tous les ids a resoudre.
	const a = collectIds(payload.teams.a, "A");
	const b = collectIds(payload.teams.b, "B");

	const allPokemonIds = [...new Set([...a.pokemonIds, ...b.pokemonIds])];
	const allTemplateIds = [...new Set([...a.templateIds, ...b.templateIds])];

	// 2. Resoudre les catalogues (une requete chacun, pas une par membre).
	const [settings, species, templates] = await Promise.all([
		findAllSettings(),
		findSpeciesByIds(allPokemonIds),
		findItemTemplatesByIds(allTemplateIds),
	]);

	// 3. Assembler les lignes plates (valide les ids au passage).
	const rowsA = buildRows(payload.teams.a, species, templates, "A");
	const rowsB = buildRows(payload.teams.b, species, templates, "B");

	// 4. Meme chaine que le combat reel a partir d'ici.
	const coeffs: StatCoeffs = {
		star: Number(settings.star_stat_coeff ?? 0.1),
		level: Number(settings.level_stat_coeff ?? 0.02),
	};
	const combatSettings: CombatSettings = {
		crit_chance_step: Number(settings.crit_chance_step ?? 0.05),
		crit_multiplier: Number(settings.crit_multiplier ?? 1.5),
		max_actions: Number(settings.max_actions ?? 1000),
	};

	// Les equipes n'appartiennent a personne : le nom vient du joueur
	// (theorycrafting), l'avatar est celui par defaut.
	const profileOf = (team: SandboxTeam, fallback: string): TeamProfile => ({
		display_name: team.name.trim() || fallback,
		avatar_url: null,
	});

	const context: CombatContext = {
		arena: "stadium",
		profiles: {
			a: profileOf(payload.teams.a, "Équipe A"),
			b: profileOf(payload.teams.b, "Équipe B"),
		},
	};

	// user_id = 0 : sentinelle, aucune equipe n'appartient a un joueur.
	const SANDBOX_USER_ID = 0;
	const teamA = prepareTeam("a" as TeamKey, SANDBOX_USER_ID, rowsA, coeffs);
	const teamB = prepareTeam("b" as TeamKey, SANDBOX_USER_ID, rowsB, coeffs);

	return resolveCombat(teamA, teamB, combatSettings, context);
}

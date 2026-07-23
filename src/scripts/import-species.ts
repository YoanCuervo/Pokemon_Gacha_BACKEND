// =====================================================================
// scripts/import-species.ts — Importe les 251 especes (Gen 1-2) depuis
// PokeAPI et genere un fichier SQL de seed.
//
// N'ECRIT PAS EN BASE : produit 012_seed_species.sql, a relire puis a
// jouer dans Workbench. On garde le fichier versionne et rejouable.
//
// N'AJOUTE QUE CE QUI MANQUE (INSERT IGNORE) : les especes deja
// configurees (lignes evolutives, pierres, couts) ne sont JAMAIS
// touchees. Les nouvelles arrivent avec evolution_line_id = id et
// aucune evolution — elles servent au bac a sable, la vraie donnee
// d'evolution sera configuree espece par espece quand le jeu en aura
// besoin.
//
// Lancement : npx tsx src/scripts/import-species.ts
// =====================================================================

import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gen 1 + Gen 2. Au-dela, les especes existent mais le jeu s'arrete la. */
const MAX_ID = 251;

/** Pause entre deux appels : PokeAPI est gratuit et sans cle, on ne
 *  le martele pas. 251 appels x 120ms = ~30 secondes. */
const DELAY_MS = 120;

/** Ou ecrire le SQL genere. Meme dossier que les autres migrations :
 *  un seed genere reste un seed, il vit avec ses semblables. */
const OUTPUT = join(process.cwd(), "migration", "012_seed_species.sql");

/** La reponse PokeAPI, reduite a ce qu'on lit. */
interface PokeApiSpecies {
	id: number;
	name: string;
	types: { slot: number; type: { name: string } }[];
	stats: { base_stat: number; stat: { name: string } }[];
}

/** Une espece prete pour le SQL. */
interface Species {
	id: number;
	name: string;
	type_primary: string;
	type_secondary: string | null;
	base_atk: number;
	base_spe: number;
	base_hp: number;
	base_def: number;
	base_spd: number;
	base_speed: number;
	generation: number;
}

/** PokeAPI -> nos colonnes.
 *  PIEGE : special-attack -> base_spe (le SPECIAL), speed -> base_speed
 *  (la VITESSE). Deux choses differentes malgre les noms proches. */
const STAT_MAP: Record<string, keyof Species> = {
	attack: "base_atk",
	"special-attack": "base_spe",
	hp: "base_hp",
	defense: "base_def",
	"special-defense": "base_spd",
	speed: "base_speed",
};

/** Gen 1 = 1-151, Gen 2 = 152-251. */
function generationOf(id: number): number {
	return id <= 151 ? 1 : 2;
}

/** Capitalise le nom PokeAPI ("charizard" -> "Charizard").
 *  Les noms composes gardent leur tiret ("ho-oh" -> "Ho-Oh") : c'est
 *  le nom EN du catalogue, la traduction FR vit dans i18n. */
function displayName(raw: string): string {
	return raw
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("-");
}

/** Echappe une chaine pour du SQL (apostrophes doublees). */
function sqlString(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

async function fetchSpecies(id: number): Promise<Species> {
	const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
	if (!res.ok) {
		throw new Error(`PokeAPI ${res.status} sur l'espece ${id}`);
	}
	const data = (await res.json()) as PokeApiSpecies;

	// Les types, dans l'ordre des slots (1 = primaire, 2 = secondaire).
	const types = [...data.types].sort((a, b) => a.slot - b.slot);
	const primary = types[0]?.type.name;
	if (!primary) throw new Error(`Espece ${id} sans type primaire`);

	const species: Species = {
		id: data.id,
		name: displayName(data.name),
		type_primary: primary,
		type_secondary: types[1]?.type.name ?? null,
		base_atk: 0,
		base_spe: 0,
		base_hp: 0,
		base_def: 0,
		base_spd: 0,
		base_speed: 0,
		generation: generationOf(data.id),
	};

	for (const entry of data.stats) {
		const column = STAT_MAP[entry.stat.name];
		if (column) {
			// Toutes les colonnes ciblees par STAT_MAP sont numeriques.
			(species[column] as number) = entry.base_stat;
		}
	}

	return species;
}

/** Une ligne VALUES du seed. */
function toValues(s: Species): string {
	return `  (${s.id}, ${sqlString(s.name)}, ${s.id}, 1, NULL, NULL, NULL, ${sqlString(s.type_primary)}, ${
		s.type_secondary ? sqlString(s.type_secondary) : "NULL"
	}, ${s.base_atk}, ${s.base_spe}, ${s.base_hp}, ${s.base_def}, ${s.base_spd}, ${s.base_speed}, ${s.generation})`;
}

function buildSql(species: Species[]): string {
	const header = `-- 012_seed_species.sql — pokemon_gacha
-- =====================================================================
-- CATALOGUE COMPLET DES ESPECES (Gen 1-2, 251 entrees)
--
-- Genere par src/scripts/import-species.ts depuis PokeAPI.
-- NE PAS EDITER A LA MAIN : relancer le script pour regenerer.
--
-- INSERT IGNORE : n'ajoute QUE les especes absentes. Les especes deja
-- configurees (lignes evolutives, pierres, couts d'evolution) ne sont
-- PAS touchees — leurs stats et leur game design restent intacts.
--
-- Les nouvelles especes arrivent avec :
--   evolution_line_id = id   (chaque espece est sa propre ligne)
--   evolution_stage   = 1
--   evolves_into_id   = NULL (aucune evolution configuree)
--   stone_id/cost     = NULL
-- Elles servent au BAC A SABLE (theorycrafting sur les 251). La vraie
-- donnee d'evolution sera configuree espece par espece quand le jeu
-- en aura besoin (gacha, aventure).
--
-- PIEGE DE NOMMAGE : base_spe = special-attack (le SPECIAL),
-- base_speed = speed (la VITESSE). Deux colonnes distinctes.
--
-- REJOUABLE : INSERT IGNORE, relancer ne change rien.
-- =====================================================================

USE pokemon_gacha;

INSERT IGNORE INTO pokemon
  (id, name, evolution_line_id, evolution_stage, evolves_into_id,
   stone_id, stone_cost, type_primary, type_secondary,
   base_atk, base_spe, base_hp, base_def, base_spd, base_speed, generation)
VALUES
`;

	return `${header + species.map(toValues).join(",\n")};\n`;
}

async function main() {
	console.log(`Import des especes 1 a ${MAX_ID} depuis PokeAPI…`);
	const all: Species[] = [];

	for (let id = 1; id <= MAX_ID; id++) {
		const species = await fetchSpecies(id);
		all.push(species);

		// Un point tous les 10 : on voit que ca avance sans noyer la sortie.
		if (id % 10 === 0) {
			console.log(`  ${id}/${MAX_ID} — ${species.name}`);
		}

		// Pause, sauf apres le dernier.
		if (id < MAX_ID) {
			await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
		}
	}

	writeFileSync(OUTPUT, buildSql(all), "utf8");

	console.log(`\n${all.length} especes ecrites dans :`);
	console.log(`  ${OUTPUT}`);
	console.log("\nRelis le fichier, puis joue-le dans Workbench.");
}

main().catch((err) => {
	console.error("ECHEC :", err);
	process.exit(1);
});

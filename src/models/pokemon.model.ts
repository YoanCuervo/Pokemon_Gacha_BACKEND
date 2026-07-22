import type {
	PoolConnection,
	ResultSetHeader,
	RowDataPacket,
} from "mysql2/promise";
import { pool } from "../config/db";
import type { InstanceRow } from "../types";

/**
 * MODEL — SQL seul, aucune regle de jeu.
 *
 * Fiche d'une instance : identite de l'espece + etat de l'instance +
 * items equipes (LEFT JOIN, jusqu'a 4 lignes). AUCUNE stat de base :
 * l'inventaire ne calcule rien (R7 vit dans la fiche de combat).
 *
 * Le filtre sur user_id est porte par le SERVICE (regle de propriete),
 * pas ici : le model rend les lignes, le service decide si tu y as droit.
 * On join quand meme user_id dans le WHERE pour ne pas ramener une
 * instance d'un autre joueur (defense en profondeur, cote SQL).
 */

interface InstanceRowPacket extends RowDataPacket, InstanceRow {}

export async function findInstanceById(
	instanceId: number,
	userId: number,
): Promise<InstanceRow[]> {
	const [rows] = await pool.query<InstanceRowPacket[]>(
		`SELECT
			pi.id AS instance_id,
			pi.pokemon_id,
			p.name,
			p.type_primary,
			p.type_secondary,
			pi.level,
			pi.stars,
			pi.is_shiny,
			ii.id            AS item_id,
			it.name          AS item_name,
			it.category      AS item_category,
			it.required_type AS item_required_type,
			it.mode          AS item_mode,
			it.boost_value   AS item_boost,
			it.rarity        AS item_rarity
		FROM pokemon_instances pi
		JOIN pokemon p ON p.id = pi.pokemon_id
		LEFT JOIN item_instances ii ON ii.pokemon_instance_id = pi.id
		LEFT JOIN item_templates it ON it.id = ii.item_template_id
		WHERE pi.id = ? AND pi.user_id = ?`,
		[instanceId, userId],
	);
	return rows;
}

/** L'instance existe-t-elle et appartient-elle au user ?
 *  Renvoie true/false, sans charger la fiche. */
export async function instanceBelongsToUserTx(
	conn: PoolConnection,
	instanceId: number,
	userId: number,
): Promise<boolean> {
	const [rows] = await conn.query<RowDataPacket[]>(
		`SELECT 1 FROM pokemon_instances WHERE id = ? AND user_id = ? LIMIT 1`,
		[instanceId, userId],
	);
	return rows.length > 0;
}

/** Un item en RESERVE (non equipe) du user + sa categorie.
 *  null si l'item n'existe pas, n'est pas au user, ou est deja equipe.
 *  On lit la categorie de l'INSTANCE (denormalisee) : c'est le slot cible. */
export async function findReserveItemForEquip(
	conn: PoolConnection,
	itemInstanceId: number,
	userId: number,
): Promise<{ category: string } | null> {
	const [rows] = await conn.query<RowDataPacket[]>(
		`SELECT category
		FROM item_instances
		WHERE id = ? AND user_id = ? AND pokemon_instance_id IS NULL
		LIMIT 1`,
		[itemInstanceId, userId],
	);
	const first = rows[0];
	return first ? { category: first.category as string } : null;
}

/** Vide le slot (category) d'un pokemon : renvoie l'item occupant en
 *  reserve. No-op si le slot est deja vide. Retourne le nb de lignes
 *  touchees (0 ou 1). */
export async function clearSlot(
	conn: PoolConnection,
	instanceId: number,
	category: string,
): Promise<number> {
	const [res] = await conn.query<ResultSetHeader>(
		`UPDATE item_instances
		SET pokemon_instance_id = NULL
		WHERE pokemon_instance_id = ? AND category = ?`,
		[instanceId, category],
	);
	return res.affectedRows;
}

/** Equipe un item sur une instance (le slot est deja libre a ce stade). */
export async function attachItem(
	conn: PoolConnection,
	itemInstanceId: number,
	instanceId: number,
): Promise<void> {
	await conn.query(
		`UPDATE item_instances
		SET pokemon_instance_id = ?
		WHERE id = ?`,
		[instanceId, itemInstanceId],
	);
}

// ---------------------------------------------------------------------
// EVOLUTION (onglet A) — R3 + evolution des shiny
// ---------------------------------------------------------------------
//
// Le model reste BETE : il ramene, pour une instance, TOUT ce qu'il faut
// aux deux cas (normal ET shiny), sans choisir :
//   - is_shiny de l'instance
//   - l'espece cible (evolves_into_id + nom)
//   - la pierre NORMALE (via cur.stone_id) : id, nom, type, quantite possedee
//   - la pierre SHINY   (via pokemon_type='shiny') : id, nom, quantite possedee
//   - le cout de BASE (cur.stone_cost) et le multiplicateur shiny
// C'est le SERVICE qui tranche : selon is_shiny, il expose la bonne
// pierre et calcule le cout effectif (base, ou base * multiplicateur).

/** Ligne brute de l'info d'evolution : les DEUX pierres + le multiplicateur.
 *  target_* / normal_stone_* a NULL si stade final (evolves_into_id NULL,
 *  stone_id NULL). shiny_stone_* existe des que la Shiny Stone est seedee
 *  (005). *_owned a 0 si pas de ligne user_stones (COALESCE). */
interface EvolutionInfoRowPacket extends RowDataPacket {
	instance_id: number;
	is_shiny: number; // MySQL BOOLEAN -> 0/1 (le service caste)
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
	shiny_multiplier: string | null; // DECIMAL -> string cote driver
}

/** Requete commune (pool ou connexion transactionnelle).
 *  Double jointure stones : ns = pierre normale (cur.stone_id),
 *  ss = pierre shiny (pokemon_type='shiny'). Double jointure user_stones
 *  pour la quantite possedee de chacune. Multiplicateur en sous-requete
 *  scalaire (une seule ligne garantie par la PK setting_key).
 *  forUpdate=true ajoute FOR UPDATE : verrouille les lignes user_stones
 *  jointes (les DEUX pierres du joueur) pour la transaction d'evolution. */
const EVOLUTION_SELECT = (forUpdate: boolean): string => `
	SELECT
		pi.id                     AS instance_id,
		pi.is_shiny,
		pi.pokemon_id             AS current_pokemon_id,
		cur.name                  AS current_name,
		cur.evolves_into_id       AS target_pokemon_id,
		tgt.name                  AS target_name,
		ns.id                     AS normal_stone_id,
		ns.name                   AS normal_stone_name,
		ns.pokemon_type           AS normal_stone_type,
		cur.stone_cost            AS base_cost,
		COALESCE(uns.quantity, 0) AS normal_owned,
		ss.id                     AS shiny_stone_id,
		ss.name                   AS shiny_stone_name,
		COALESCE(uss.quantity, 0) AS shiny_owned,
		(SELECT setting_value FROM game_settings
		 WHERE setting_key = 'shiny_evolution_multiplier') AS shiny_multiplier
	FROM pokemon_instances pi
	JOIN pokemon cur          ON cur.id = pi.pokemon_id
	LEFT JOIN pokemon tgt     ON tgt.id = cur.evolves_into_id
	LEFT JOIN stones ns       ON ns.id = cur.stone_id
	LEFT JOIN user_stones uns ON uns.stone_id = ns.id AND uns.user_id = pi.user_id
	LEFT JOIN stones ss       ON ss.pokemon_type = 'shiny'
	LEFT JOIN user_stones uss ON uss.stone_id = ss.id AND uss.user_id = pi.user_id
	WHERE pi.id = ? AND pi.user_id = ?
	${forUpdate ? "FOR UPDATE" : "LIMIT 1"}`;

/** Lecture (pool) pour le GET /:instanceId/evolution.
 *  Renvoie null si l'instance n'existe pas / n'est pas au joueur. */
export async function findEvolutionInfo(
	instanceId: number,
	userId: number,
): Promise<EvolutionInfoRowPacket | null> {
	const [rows] = await pool.query<EvolutionInfoRowPacket[]>(
		EVOLUTION_SELECT(false),
		[instanceId, userId],
	);
	return rows[0] ?? null;
}

/** Lecture VERROUILLEE (transaction) pour l'evolution.
 *  Meme requete + FOR UPDATE : verrouille les lignes user_stones des
 *  deux pierres du joueur (on ne sait laquelle on va decrementer qu'apres
 *  avoir lu is_shiny cote service ; verrouiller les deux — deux lignes
 *  d'un meme joueur — n'a aucun cout de contention reel).
 *  Renvoie null si instance introuvable / pas au joueur. */
export async function lockEvolutionForUpdate(
	conn: PoolConnection,
	instanceId: number,
	userId: number,
): Promise<EvolutionInfoRowPacket | null> {
	const [rows] = await conn.query<EvolutionInfoRowPacket[]>(
		EVOLUTION_SELECT(true),
		[instanceId, userId],
	);
	return rows[0] ?? null;
}

/** Decremente le pot d'une pierre precise. La ligne user_stones EXISTE
 *  forcement ici (owned >= cost >= 1 verifie avant). On ne supprime
 *  jamais la ligne a 0 (coherence user_fragments). */
export async function consumeStones(
	conn: PoolConnection,
	userId: number,
	stoneId: number,
	amount: number,
): Promise<void> {
	await conn.query(
		`UPDATE user_stones
		SET quantity = quantity - ?
		WHERE user_id = ? AND stone_id = ?`,
		[amount, userId, stoneId],
	);
}

/** Change l'espece de l'instance. Tout le reste de la ligne
 *  (stars, star_progress, level, xp, is_shiny) est conserve
 *  mecaniquement. Les items restent attaches (ils pointent sur
 *  l'instance_id, pas le pokemon_id). Un shiny reste shiny. */
export async function setInstanceSpecies(
	conn: PoolConnection,
	instanceId: number,
	newPokemonId: number,
): Promise<void> {
	await conn.query(
		`UPDATE pokemon_instances
		SET pokemon_id = ?
		WHERE id = ?`,
		[newPokemonId, instanceId],
	);
}

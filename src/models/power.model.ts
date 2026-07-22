import type {
	PoolConnection,
	ResultSetHeader,
	RowDataPacket,
} from "mysql2/promise";
import { pool } from "../config/db";

/**
 * MODEL — SQL seul, aucune regle de jeu.
 *
 * PUISSANCE (onglet B) : etoiles et decraft.
 * Le pot de fragments est par LIGNE EVOLUTIVE (user_fragments.
 * evolution_line_id), pas par espece : les fragments d'un Dracaufeu
 * decrafte servent a monter les etoiles d'un Salameche. C'est ce qui
 * definit un "doublon" cote joueur : meme evolution_line_id.
 */

/** Etat etoiles d'une instance + son pot de fragments + le cout du
 *  prochain palier. Une seule requete : tout ce qu'il faut a l'affichage
 *  et a la decision de montee. */
export interface StarStateRow extends RowDataPacket {
	instance_id: number;
	pokemon_id: number;
	stars: number;
	evolution_line_id: number;
	fragments_owned: number;
	/** Cout pour l'etoile SUIVANTE. NULL si deja 5 etoiles (max). */
	next_star_cost: number | null;
}

/** Requete commune GET / transaction. forUpdate ajoute FOR UPDATE :
 *  verrouille la ligne user_fragments jointe (celle qu'on va debiter). */
const STAR_STATE_SELECT = (forUpdate: boolean): string => `
	SELECT
		pi.id                     AS instance_id,
		pi.pokemon_id,
		pi.stars,
		p.evolution_line_id,
		COALESCE(uf.quantity, 0)  AS fragments_owned,
		sc.fragment_cost          AS next_star_cost
	FROM pokemon_instances pi
	JOIN pokemon p ON p.id = pi.pokemon_id
	LEFT JOIN user_fragments uf
		ON uf.evolution_line_id = p.evolution_line_id
		AND uf.user_id = pi.user_id
	LEFT JOIN star_costs sc ON sc.star_level = pi.stars + 1
	WHERE pi.id = ? AND pi.user_id = ?
	${forUpdate ? "FOR UPDATE" : "LIMIT 1"}`;

/** Lecture (pool) de l'etat etoiles pour le GET. */
export async function findStarState(
	instanceId: number,
	userId: number,
): Promise<StarStateRow | null> {
	const [rows] = await pool.query<StarStateRow[]>(STAR_STATE_SELECT(false), [
		instanceId,
		userId,
	]);
	return rows[0] ?? null;
}

/** Lecture VERROUILLEE de l'etat etoiles (transaction). */
export async function lockStarStateForUpdate(
	conn: PoolConnection,
	instanceId: number,
	userId: number,
): Promise<StarStateRow | null> {
	const [rows] = await conn.query<StarStateRow[]>(STAR_STATE_SELECT(true), [
		instanceId,
		userId,
	]);
	return rows[0] ?? null;
}

/** Une instance decraftable : meme ligne evolutive que la cible, au
 *  joueur, PAS la cible elle-meme, PAS dans l'equipe. */
export interface DecraftableRow extends RowDataPacket {
	instance_id: number;
	pokemon_id: number;
	name: string;
	stars: number;
	level: number;
	xp: number;
	/** XP TOTALE investie = cumul des paliers franchis + progression
	 *  en cours. Base du remboursement au decraft (25%). */
	total_xp: number;
	is_shiny: number | boolean;
}

/** Colonnes communes aux deux lectures de decraftables. */
const DECRAFTABLE_COLUMNS = `
		pi.id AS instance_id,
		pi.pokemon_id,
		p.name,
		pi.stars,
		pi.level,
		pi.xp,
		COALESCE(lc.xp_required, 0) + pi.xp AS total_xp,
		pi.is_shiny`;

/** Jointures communes : espece (pour evolution_line_id) + bareme XP. */
const DECRAFTABLE_JOINS = `
	JOIN pokemon p ON p.id = pi.pokemon_id
	LEFT JOIN level_costs lc ON lc.level = pi.level`;

/** Garde-fous communs (regles de securite portees par le SQL) :
 *   - meme evolution_line_id que la cible (c'est ca, un "doublon")
 *   - au joueur
 *   - != la cible (on ne se sacrifie pas soi-meme)
 *   - absente de team_slots (une instance en equipe n'est pas sacrifiable) */
const DECRAFTABLE_GUARDS = `
		pi.user_id = ?
		AND pi.id <> ?
		AND p.evolution_line_id = (
			SELECT p2.evolution_line_id
			FROM pokemon_instances pi2
			JOIN pokemon p2 ON p2.id = pi2.pokemon_id
			WHERE pi2.id = ? AND pi2.user_id = ?
		)
		AND pi.id NOT IN (
			SELECT ts.pokemon_instance_id FROM team_slots ts WHERE ts.user_id = ?
		)`;

/** Les instances sacrifiables pour une cible donnee (GET).
 *  Trie par etoiles puis niveau croissants : les plus faibles d'abord,
 *  ce que le joueur veut sacrifier en priorite. */
export async function findDecraftable(
	instanceId: number,
	userId: number,
): Promise<DecraftableRow[]> {
	const [rows] = await pool.query<DecraftableRow[]>(
		`SELECT ${DECRAFTABLE_COLUMNS}
		FROM pokemon_instances pi
		${DECRAFTABLE_JOINS}
		WHERE ${DECRAFTABLE_GUARDS}
		ORDER BY pi.stars, pi.level`,
		[userId, instanceId, instanceId, userId, userId],
	);
	return rows;
}

/** Les instances a sacrifier, VERROUILLEES, avec les MEMES garde-fous.
 *  Re-verifie tout en transaction : une instance peut avoir rejoint
 *  l'equipe entre l'affichage et la validation. Renvoie uniquement les
 *  instances REELLEMENT sacrifiables ; le service compare la taille au
 *  nombre demande pour detecter un refus. */
export async function lockDecraftablesForUpdate(
	conn: PoolConnection,
	instanceIds: number[],
	targetInstanceId: number,
	userId: number,
): Promise<DecraftableRow[]> {
	if (instanceIds.length === 0) return [];

	// Placeholders generes depuis la LONGUEUR du tableau, jamais depuis
	// son contenu : les valeurs restent parametrees.
	const placeholders = instanceIds.map(() => "?").join(", ");

	const [rows] = await conn.query<DecraftableRow[]>(
		`SELECT ${DECRAFTABLE_COLUMNS}
		FROM pokemon_instances pi
		${DECRAFTABLE_JOINS}
		WHERE pi.id IN (${placeholders})
			AND ${DECRAFTABLE_GUARDS}
		FOR UPDATE`,
		[
			...instanceIds,
			userId,
			targetInstanceId,
			targetInstanceId,
			userId,
			userId,
		],
	);
	return rows;
}

/** Le bareme des couts d'etoile (star_costs).
 *  Lu a chaque appel : un UPDATE en base prend effet sans redemarrer. */
export async function findStarCosts(): Promise<Map<number, number>> {
	const [rows] = await pool.query<RowDataPacket[]>(
		`SELECT star_level, fragment_cost FROM star_costs ORDER BY star_level`,
	);
	const map = new Map<number, number>();
	for (const row of rows) {
		map.set(Number(row.star_level), Number(row.fragment_cost));
	}
	return map;
}

// ---------------------------------------------------------------------
// ECRITURES
// ---------------------------------------------------------------------

/** Debite le pot de fragments d'une ligne evolutive.
 *  La ligne user_fragments EXISTE ici (verifie avant : owned >= cost).
 *  On ne supprime jamais la ligne a 0 (coherence user_stones). */
export async function consumeFragments(
	conn: PoolConnection,
	userId: number,
	evolutionLineId: number,
	amount: number,
): Promise<void> {
	await conn.query(
		`UPDATE user_fragments
		SET quantity = quantity - ?
		WHERE user_id = ? AND evolution_line_id = ?`,
		[amount, userId, evolutionLineId],
	);
}

export async function addFragments(
	conn: PoolConnection,
	userId: number,
	evolutionLineId: number,
	amount: number,
): Promise<void> {
	await conn.query(
		`INSERT INTO user_fragments (user_id, evolution_line_id, quantity)
		VALUES (?, ?, ?) AS new
		ON DUPLICATE KEY UPDATE quantity = user_fragments.quantity + new.quantity`,
		[userId, evolutionLineId, amount],
	);
}

export async function addCandies(
	conn: PoolConnection,
	userId: number,
	amount: number,
): Promise<void> {
	await conn.query(
		`INSERT INTO user_candies (user_id, candy_type, quantity)
		VALUES (?, 'xp', ?) AS new
		ON DUPLICATE KEY UPDATE quantity = user_candies.quantity + new.quantity`,
		[userId, amount],
	);
}

/** Monte l'instance d'une etoile. star_progress remis a 0 : la colonne
 *  n'est plus utilisee (le pot fait foi), on la garde coherente. */
export async function incrementStar(
	conn: PoolConnection,
	instanceId: number,
): Promise<void> {
	await conn.query(
		`UPDATE pokemon_instances
		SET stars = stars + 1, star_progress = 0
		WHERE id = ?`,
		[instanceId],
	);
}

/** Supprime definitivement les instances sacrifiees.
 *  DESTRUCTIF. Les item_instances equipes dessus sont liberes par la FK
 *  fk_ii_pokemon (ON DELETE SET NULL, verifie) : les items retournent
 *  en reserve, ils ne sont PAS detruits. */
export async function deleteInstances(
	conn: PoolConnection,
	instanceIds: number[],
): Promise<number> {
	if (instanceIds.length === 0) return 0;
	const placeholders = instanceIds.map(() => "?").join(", ");
	const [res] = await conn.query<ResultSetHeader>(
		`DELETE FROM pokemon_instances WHERE id IN (${placeholders})`,
		instanceIds,
	);
	return res.affectedRows;
}

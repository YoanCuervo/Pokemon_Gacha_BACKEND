import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db";

/**
 * MODEL — les constantes d'equilibrage.
 *
 * Fichier separe de team.model.ts : game_settings n'a rien a voir
 * avec l'equipe. Le jour ou l'evolution ou le combat auront besoin
 * des coefficients, ils taperont ici aussi.
 */

/** Le contenu de game_settings, en cle/valeur. */
export type GameSettings = Record<string, number>;

/**
 * Charge toutes les constantes d'un coup.
 *
 * Une seule requete pour les 6 reglages, pas une par cle. Le service
 * appelle ca UNE fois par GET, garde le resultat, et calcule ses 6
 * pokemon avec. Sinon on ferait 24 requetes pour afficher une equipe.
 */
export async function findAllSettings(): Promise<GameSettings> {
	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT setting_key, setting_value FROM game_settings",
	);

	// On transforme [{key, value}, ...] en { key: value, ... }
	// pour que le service ecrive settings.star_stat_coeff et pas
	// rows.find(r => r.setting_key === "star_stat_coeff")?.setting_value
	const settings: GameSettings = {};
	for (const row of rows) {
		settings[row.setting_key] = row.setting_value;
	}

	return settings;
}

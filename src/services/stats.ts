// =====================================================================
// services/stats.ts — R7 : LE canal unique de calcul des stats.
// Utilisé par le team service (affichage) ET le moteur de combat.
// Jamais de stat stockée, jamais de calcul dupliqué ailleurs.
//
//   stat = base
//          * (1 + star_stat_coeff  * (stars - 1))
//          * (1 + level_stat_coeff * (level - 1))
//          + somme des boosts d'items sur cette stat
// =====================================================================

/** Coefficients lus dans game_settings (star_stat_coeff, level_stat_coeff). */
export interface StatCoeffs {
	star: number; // ex. 0.10
	level: number; // ex. 0.02
}

/**
 * R7 pour UNE stat.
 * `boosts` = somme des boost_value des items équipés qui visent cette
 * stat (0 si aucun). Résultat arrondi à l'entier : les deux chiffres
 * affichés (et le combat) travaillent en entiers.
 */
export function computeStat(
	base: number,
	stars: number,
	level: number,
	boosts: number,
	coeffs: StatCoeffs,
): number {
	const value =
		base * (1 + coeffs.star * (stars - 1)) * (1 + coeffs.level * (level - 1)) +
		boosts;
	return Math.round(value);
}

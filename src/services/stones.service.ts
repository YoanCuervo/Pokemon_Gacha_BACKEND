import { findStonesByUserId } from "../models/stones.model";
import type { StonesResponse } from "../types";

/** SERVICE — les regles du jeu.
 *Lecture pure : aucune regle metier a appliquer ici. Le service existe quand meme pour tenir la couche (le controller ne parle jamais au model directement) et pour accueillir les regles futures du Sac a dos (tri, regroupement, filtres) sans changer la signature. Pas de StonesError : une lecture de pierres ne peut pas echouer metier. Joueur sans aucune pierre -> tableau vide, pas une erreur(le front affiche une grille vide, c'est un etat valide).*/

/** Toutes les pierres du joueur (GET /api/stones). */
export async function getStones(userId: number): Promise<StonesResponse> {
	const stones = await findStonesByUserId(userId);
	return { stones };
}

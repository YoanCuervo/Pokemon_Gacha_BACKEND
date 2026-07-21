import { findReserveByUserId } from "../models/item.model";
import type { ReserveItem } from "../types";

// Pas de regle metier sur la lecture de la reserve (comme box.service) :
// on rend tout, le front filtre. Le service existe pour la symetrie et
// accueillera les regles futures (ex. filtres serveur si le volume grossit).
export function getReserve(userId: number): Promise<ReserveItem[]> {
	return findReserveByUserId(userId);
}

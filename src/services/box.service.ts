import { findBoxInstancesByUserId } from "../models/box.model";
import type { BoxInstance } from "../types";

// Pas de regle metier sur la lecture de la boite (reserve illimitee).
// Le service existe pour la symetrie de l'architecture et accueillera
// les regles futures (filtres, tri par ligne evolutive, etc.)
export function getBox(userId: number): Promise<BoxInstance[]> {
	return findBoxInstancesByUserId(userId);
}

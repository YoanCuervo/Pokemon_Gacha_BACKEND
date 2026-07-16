import fs from "node:fs/promises";
import * as photoModel from "../models/photo.model";
import type { PhotoRow } from "../models/photo.model";

const PHOTO_SLOTS = 4; // constante = source de verite (cf. TEAM_SIZE)

export type PhotoErrorCode =
	| "NOT_OWNED"
	| "SLOTS_FULL"
	| "NOT_FOUND"
	| "VALIDATION";

export class PhotoError extends Error {
	constructor(
		message: string,
		public code: PhotoErrorCode,
	) {
		super(message);
		this.name = "PhotoError";
	}
}

export type PhotosResponse = {
	photos: PhotoRow[];
	active_photo_id: number | null;
};

export async function getPhotos(userId: number): Promise<PhotosResponse> {
	const [photos, activeId] = await Promise.all([
		photoModel.findPhotosByUser(userId),
		photoModel.findActivePhotoId(userId),
	]);
	return { photos, active_photo_id: activeId };
}

/**
 * R9 : le plus petit slot libre parmi 1-4. Aucun libre -> SLOTS_FULL.
 * uq_up_slot garantit la limite en base ; ce calcul evite juste de
 * laisser MySQL trancher a coups de 500.
 */
async function findFreeSlot(userId: number): Promise<number> {
	const photos = await photoModel.findPhotosByUser(userId);
	const taken = new Set(photos.map((p) => p.slot_position));
	for (let slot = 1; slot <= PHOTO_SLOTS; slot++) {
		if (!taken.has(slot)) return slot;
	}
	throw new PhotoError("Les 4 slots sont occupes", "SLOTS_FULL");
}

/**
 * Multer a DEJA ecrit le fichier sur le disque quand on arrive ici.
 * Si l'INSERT echoue, on supprime le fichier : sinon il reste orphelin
 * sur le disque, sans ligne en base pour le retrouver.
 */
export async function addPhoto(
	userId: number,
	filePath: string,
): Promise<{ id: number; slot_position: number; file_path: string }> {
	// Multer renvoie un chemin OS (backslashes sous Windows). On stocke
	// en slashes : le meme champ sert de chemin disque ET d'URL front.
	const normalized = filePath.replace(/\\/g, "/");

	let slot: number;
	try {
		slot = await findFreeSlot(userId);
	} catch (err) {
		await fs.unlink(filePath).catch(() => {});
		throw err;
	}

	try {
		const id = await photoModel.insertPhoto(userId, slot, normalized);
		return { id, slot_position: slot, file_path: normalized };
	} catch (err) {
		await fs.unlink(filePath).catch(() => {});
		throw err;
	}
}

/**
 * R9 : DELETE la ligne ET unlink le fichier.
 * Ordre : base d'abord. Si le DELETE echoue, le fichier est toujours
 * la et la ligne aussi -> etat coherent. L'inverse laisserait une
 * ligne pointant vers un fichier disparu.
 * active_avatar_id se met a NULL tout seul (ON DELETE SET NULL).
 */
export async function removePhoto(
	userId: number,
	photoId: number,
): Promise<void> {
	const photo = await photoModel.findPhotoById(photoId);
	if (!photo) throw new PhotoError("Photo introuvable", "NOT_FOUND");
	if (photo.user_id !== userId) {
		throw new PhotoError("Cette photo ne t'appartient pas", "NOT_OWNED");
	}

	await photoModel.deletePhoto(photoId);
	await fs.unlink(photo.file_path).catch(() => {});
}

/** R8 : la photo active doit appartenir au joueur. */
export async function setActivePhoto(
	userId: number,
	photoId: number,
): Promise<void> {
	const photo = await photoModel.findPhotoById(photoId);
	if (!photo) throw new PhotoError("Photo introuvable", "NOT_FOUND");
	if (photo.user_id !== userId) {
		throw new PhotoError("Cette photo ne t'appartient pas", "NOT_OWNED");
	}

	await photoModel.updateActivePhoto(userId, photoId);
}

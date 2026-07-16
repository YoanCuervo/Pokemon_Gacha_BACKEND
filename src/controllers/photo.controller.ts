import type { Request, Response } from "express";
import * as photoService from "../services/photo.service";
import { PhotoError } from "../services/photo.service";

/** Point de bascule JWT unique (cf. team.controller). */
function getUserId(): number {
	return Number(process.env.DEV_USER_ID) || 1;
}

const STATUS_BY_CODE: Record<string, number> = {
	NOT_OWNED: 403,
	SLOTS_FULL: 409,
	NOT_FOUND: 404,
	VALIDATION: 400,
};

function handleError(err: unknown, res: Response): void {
	if (err instanceof PhotoError) {
		res.status(STATUS_BY_CODE[err.code] ?? 400).json({
			error: err.message,
			code: err.code,
		});
		return;
	}
	console.error(err);
	res.status(500).json({ error: "Erreur serveur" });
}

export async function getPhotos(_req: Request, res: Response): Promise<void> {
	try {
		const data = await photoService.getPhotos(getUserId());
		res.json(data);
	} catch (err) {
		handleError(err, res);
	}
}

export async function addPhoto(req: Request, res: Response): Promise<void> {
	try {
		// Multer remplit req.file. Absent = aucun fichier envoye.
		if (!req.file) {
			res.status(400).json({ error: "Aucun fichier", code: "VALIDATION" });
			return;
		}
		const photo = await photoService.addPhoto(getUserId(), req.file.path);
		res.status(201).json(photo);
	} catch (err) {
		handleError(err, res);
	}
}

export async function removePhoto(req: Request, res: Response): Promise<void> {
	try {
		const photoId = Number(req.params.id);
		if (!Number.isInteger(photoId)) {
			res.status(400).json({ error: "id invalide", code: "VALIDATION" });
			return;
		}
		await photoService.removePhoto(getUserId(), photoId);
		res.json({ ok: true });
	} catch (err) {
		handleError(err, res);
	}
}

export async function setActivePhoto(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const photoId = Number(req.body?.photo_id);
		if (!Number.isInteger(photoId)) {
			res.status(400).json({ error: "photo_id invalide", code: "VALIDATION" });
			return;
		}
		await photoService.setActivePhoto(getUserId(), photoId);
		res.json({ ok: true });
	} catch (err) {
		handleError(err, res);
	}
}

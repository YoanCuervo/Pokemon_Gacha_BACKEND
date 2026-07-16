import type { Request, Response } from "express";
import * as userService from "../services/user.service";
import { UserError } from "../services/user.service";

function getUserId(): number {
	return Number(process.env.DEV_USER_ID) || 1;
}

const STATUS_BY_CODE: Record<string, number> = {
	NOT_FOUND: 404,
	VALIDATION: 400,
};

function handleError(err: unknown, res: Response): void {
	if (err instanceof UserError) {
		res.status(STATUS_BY_CODE[err.code] ?? 400).json({
			error: err.message,
			code: err.code,
		});
		return;
	}
	console.error(err);
	res.status(500).json({ error: "Erreur serveur" });
}

export async function getMe(_req: Request, res: Response): Promise<void> {
	try {
		const user = await userService.getMe(getUserId());
		res.json(user);
	} catch (err) {
		handleError(err, res);
	}
}

export async function setCountry(req: Request, res: Response): Promise<void> {
	try {
		const country = req.body?.country;
		if (typeof country !== "string") {
			res.status(400).json({ error: "country invalide", code: "VALIDATION" });
			return;
		}
		await userService.setCountry(getUserId(), country);
		res.json({ ok: true });
	} catch (err) {
		handleError(err, res);
	}
}

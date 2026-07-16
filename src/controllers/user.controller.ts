import type { Request, Response } from "express";
import * as userService from "../services/user.service";
import { UserError } from "../services/user.service";

function getUserId(): number {
	return Number(process.env.DEV_USER_ID) || 1;
}

export async function getMe(_req: Request, res: Response): Promise<void> {
	try {
		const user = await userService.getMe(getUserId());
		res.json(user);
	} catch (err) {
		if (err instanceof UserError) {
			res.status(404).json({ error: err.message, code: err.code });
			return;
		}
		console.error(err);
		res.status(500).json({ error: "Erreur serveur" });
	}
}

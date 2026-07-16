import type { UserRow } from "../models/user.model";
import * as userModel from "../models/user.model";

export class UserError extends Error {
	constructor(
		message: string,
		public code: "NOT_FOUND" | "VALIDATION",
	) {
		super(message);
		this.name = "UserError";
	}
}

export async function setCountry(
	userId: number,
	country: string,
): Promise<void> {
	if (!/^[A-Za-z]{2}$/.test(country)) {
		throw new UserError("Code pays invalide", "VALIDATION");
	}
	const rows = await userModel.updateCountry(userId, country.toUpperCase());
	if (rows === 0) throw new UserError("Joueur introuvable", "NOT_FOUND");
}

export async function getMe(userId: number): Promise<UserRow> {
	const user = await userModel.findUserById(userId);
	if (!user) throw new UserError("Joueur introuvable", "NOT_FOUND");
	return user;
}

import type { UserRow } from "../models/user.model";
import * as userModel from "../models/user.model";

export class UserError extends Error {
	constructor(
		message: string,
		public code: "NOT_FOUND",
	) {
		super(message);
		this.name = "UserError";
	}
}

export async function getMe(userId: number): Promise<UserRow> {
	const user = await userModel.findUserById(userId);
	if (!user) throw new UserError("Joueur introuvable", "NOT_FOUND");
	return user;
}

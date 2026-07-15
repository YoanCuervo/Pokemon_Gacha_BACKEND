import dotenv from "dotenv";
import mysql from "mysql2/promise";

// Charge le .env dans process.env.
// Doit etre appele avant toute lecture de process.env, donc en haut du fichier.
dotenv.config();

/**
 * Pool de connexions MySQL.
 *
 * Pourquoi un pool et pas createConnection() :
 * une connexion unique est partagee par toutes les requetes et devient
 * un goulot d'etranglement. Le pool en garde plusieurs ouvertes et les
 * distribue. C'est aussi ce qui permettra les transactions plus tard
 * (chaque transaction a besoin de sa propre connexion).
 */

export const pool = mysql.createPool({
	host: process.env.DB_HOST || "localhost",
	port: Number(process.env.DB_PORT) || 3306,
	user: process.env.DB_USER || "root",
	password: process.env.DB_PASSWORD || "",
	database: process.env.DB_NAME || "pokemon_gacha",

	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,

	decimalNumbers: true,

	/*
	 * Caste les TINYINT(1) en booleen des la sortie de la base.
	 *
	 * MySQL n'a pas de vrai type booleen : BOOLEAN est un alias de
	 * TINYINT(1), et mysql2 renvoie donc 0 ou 1. Sans ce cast, il
	 * faudrait convertir a la main dans chaque requete qui touche
	 * is_shiny — et il suffit d'un oubli pour que les types mentent.
	 *
	 * Le cast se fait ici, une fois, a la frontiere avec la base.
	 *
	 * Attention : s'applique a TOUS les TINYINT(1). Dans ton schema,
	 * is_shiny est le seul (stars, evolution_stage et slot_position
	 * sont des TINYINT UNSIGNED, pas des TINYINT(1)).
	 *
	 * field.string() renvoie une STRING, d'ou le === "1" et pas === 1.
	 * Boolean(field.string()) serait un bug : "0" est truthy.
	 */

	typeCast: (field, next) => {
		if (field.type === "TINY" && field.length === 1) {
			return field.string() === "1";
		}
		return next();
	},
});

/**
 * Verifie que la base repond. Appele au demarrage du serveur.
 * Mieux vaut planter tout de suite avec un message clair qu'a la
 * premiere requete d'un utilisateur.
 */
export async function testConnection(): Promise<void> {
	const conn = await pool.getConnection();
	await conn.ping();
	conn.release(); // TOUJOURS relacher, sinon le pool se vide et tout gele
}

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { testConnection } from "./config/db";
import boxRouter from "./routes/box.routes";
import combatRoutes from "./routes/combat.routes";
import itemRouter from "./routes/item.routes";
import photoRouter from "./routes/photo.routes";
import pokemonRouter from "./routes/pokemon.routes";
import stonesRouter from "./routes/stones.routes";
import teamRoutes from "./routes/team.routes";
import userRouter from "./routes/user.routes";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ---------------------------------------------------------------
// MIDDLEWARES
// L'ORDRE COMPTE. Express execute dans l'ordre de declaration.
// express.json() doit venir AVANT les routes, sinon req.body est
// undefined et tu cherches pendant une heure.
// ---------------------------------------------------------------

/**
 * CORS : sans ca, ton front sur :5173 ne peut pas appeler ton back
 * sur :3001. Le navigateur bloque la reponse (meme si le serveur a
 * repondu correctement). C'est la Same-Origin Policy.
 *
 * origin: true renvoie l'origine de la requete. Suffisant en dev.
 * En prod, mets l'URL exacte de ton front — sinon n'importe quel
 * site peut appeler ton API depuis le navigateur de tes joueurs.
 */
app.use(cors({ origin: true }));

/** Parse les body JSON. Sans lui, req.body est undefined. */
app.use(express.json());

/**
 * Sert les fichiers uploades. Sans ca, les photos sont stockees mais
 * inaccessibles depuis le front. Le chemin URL /uploads/... mappe le
 * dossier disque uploads/.
 */
app.use("/api/uploads", express.static("uploads"));

// ---------------------------------------------------------------
// ROUTES
// Le prefixe est monte ici, pas dans le routeur. Le routeur ne sait
// pas ou il vit — on peut le deplacer sans le toucher.
// ---------------------------------------------------------------

app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

app.use("/api/team", teamRoutes);
app.use("/api/box", boxRouter);
app.use("/api/photos", photoRouter);
app.use("/api/me", userRouter);
app.use("/api/combat", combatRoutes);
app.use("/api/pokemon", pokemonRouter);
app.use("/api/items", itemRouter);
app.use("/api/stones", stonesRouter);

// 404 sur tout le reste. Doit etre APRES les routes.
app.use((_req, res) => {
	res.status(404).json({ error: "Route inconnue" });
});

// ---------------------------------------------------------------
// DEMARRAGE
// ---------------------------------------------------------------

async function start() {
	try {
		// On teste la base AVANT d'ecouter. Mieux vaut planter tout de
		// suite avec un message clair que de repondre 500 a la premiere
		// requete d'un utilisateur.
		await testConnection();
		console.log("Base de donnees connectee");

		app.listen(PORT, () => {
			console.log(`Serveur demarre sur http://localhost:${PORT}`);
		});
	} catch (err) {
		console.error("Impossible de demarrer :", err);
		process.exit(1);
	}
}

start();

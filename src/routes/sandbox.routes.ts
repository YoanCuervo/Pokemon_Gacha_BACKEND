import { Router } from "express";
import {
	getItemCatalogHandler,
	getSpeciesCatalogHandler,
	postSandboxCombatHandler,
	postSandboxPreviewHandler,
} from "../controllers/sandbox.controller";

/**
 * Routes du BAC A SABLE (theorycrafting).
 *
 * Les deux GET alimentent les selecteurs du front (catalogues complets,
 * filtres en memoire cote client — meme pattern que la reserve d'items).
 * Les deux POST ne touchent JAMAIS a la base : les equipes du bac a
 * sable sont ephemeres.
 */
const sandboxRouter = Router();

sandboxRouter.get("/species", getSpeciesCatalogHandler);
sandboxRouter.get("/items", getItemCatalogHandler);
sandboxRouter.post("/preview", postSandboxPreviewHandler);
sandboxRouter.post("/combat", postSandboxCombatHandler);

export default sandboxRouter;

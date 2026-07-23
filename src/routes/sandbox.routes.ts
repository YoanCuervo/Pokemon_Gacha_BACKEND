import { Router } from "express";
import {
	getItemCatalogHandler,
	getSpeciesCatalogHandler,
	postSandboxCombatHandler,
} from "../controllers/sandbox.controller";

/**
 * Routes du BAC A SABLE (theorycrafting).
 * Les deux GET alimentent les selecteurs du front (catalogues complets,
 * filtres en memoire cote client — meme pattern que la reserve d'items).
 * Le POST resout un combat sans rien ecrire en base.
 */
const sandboxRouter = Router();

sandboxRouter.get("/species", getSpeciesCatalogHandler);
sandboxRouter.get("/items", getItemCatalogHandler);
sandboxRouter.post("/combat", postSandboxCombatHandler);

export default sandboxRouter;

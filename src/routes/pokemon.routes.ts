import { Router } from "express";
import {
	equipHandler,
	getInstanceHandler,
	unequipHandler,
} from "../controllers/pokemon.controller";

const pokemonRouter = Router();

pokemonRouter.get("/:instanceId", getInstanceHandler);
pokemonRouter.patch("/:instanceId/equip", equipHandler);
pokemonRouter.patch("/:instanceId/unequip", unequipHandler);

export default pokemonRouter;

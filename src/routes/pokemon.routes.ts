import { Router } from "express";
import {
	equipHandler,
	evolveHandler,
	getEvolutionHandler,
	getInstanceHandler,
	unequipHandler,
} from "../controllers/pokemon.controller";

const pokemonRouter = Router();

pokemonRouter.get("/:instanceId", getInstanceHandler);
pokemonRouter.get("/:instanceId/evolution", getEvolutionHandler);
pokemonRouter.patch("/:instanceId/equip", equipHandler);
pokemonRouter.patch("/:instanceId/unequip", unequipHandler);
pokemonRouter.post("/:instanceId/evolve", evolveHandler);

export default pokemonRouter;

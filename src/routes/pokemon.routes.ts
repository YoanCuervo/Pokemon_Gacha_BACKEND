import { Router } from "express";
import {
	equipHandler,
	getInstanceHandler,
} from "../controllers/pokemon.controller";

const pokemonRouter = Router();

pokemonRouter.get("/:instanceId", getInstanceHandler);
pokemonRouter.patch("/:instanceId/equip", equipHandler);

export default pokemonRouter;

import { Router } from "express";
import { getInstanceHandler } from "../controllers/pokemon.controller";

const pokemonRouter = Router();

pokemonRouter.get("/:instanceId", getInstanceHandler);

export default pokemonRouter;

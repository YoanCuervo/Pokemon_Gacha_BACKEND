import { Router } from "express";
import {
	decraftHandler,
	getPowerHandler,
	upgradeStarHandler,
} from "../controllers/power.controller";

/**
 * Routes PUISSANCE. Montees sous /api/pokemon (les trois gestes
 * portent sur une instance precise), a cote des routes evolution.
 */
const powerRouter = Router();

powerRouter.get("/:instanceId/power", getPowerHandler);
powerRouter.post("/:instanceId/star", upgradeStarHandler);
powerRouter.post("/:instanceId/decraft", decraftHandler);

export default powerRouter;

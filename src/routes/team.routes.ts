import { Router } from "express";
import {
	addToTeamHandler,
	getTeamHandler,
	removeFromTeamHandler,
	reorderTeamHandler,
} from "../controllers/team.controller";

const router = Router();

router.get("/", getTeamHandler);
router.post("/", addToTeamHandler);
router.patch("/reorder", reorderTeamHandler);
router.delete("/:slot", removeFromTeamHandler);

export default router;
("");

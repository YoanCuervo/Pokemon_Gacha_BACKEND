import { Router } from "express";
import {
	getExperienceHandler,
	useCandiesHandler,
} from "../controllers/experience.controller";

const experienceRouter = Router();

experienceRouter.get("/:instanceId/experience", getExperienceHandler);
experienceRouter.post("/:instanceId/experience", useCandiesHandler);

export default experienceRouter;

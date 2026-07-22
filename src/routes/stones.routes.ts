import { Router } from "express";
import { getStonesHandler } from "../controllers/stones.controller";

const stonesRouter = Router();

stonesRouter.get("/", getStonesHandler);

export default stonesRouter;
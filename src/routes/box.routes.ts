import { Router } from "express";
import { getBoxHandler } from "../controllers/box.controller";

const boxRouter = Router();

boxRouter.get("/", getBoxHandler);

export default boxRouter;

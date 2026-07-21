import { Router } from "express";
import { getReserveHandler } from "../controllers/item.controller";

const itemRouter = Router();

itemRouter.get("/reserve", getReserveHandler);

export default itemRouter;

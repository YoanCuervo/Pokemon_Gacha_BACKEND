import { Router } from "express";
import * as userController from "../controllers/user.controller";

const router = Router();

router.get("/", userController.getMe);
router.patch("/country", userController.setCountry);

export default router;

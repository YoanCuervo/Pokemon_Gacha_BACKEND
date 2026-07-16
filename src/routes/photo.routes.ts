import { Router } from "express";
import { uploadAvatar } from "../config/upload";
import * as photoController from "../controllers/photo.controller";

const router = Router();

router.get("/", photoController.getPhotos);
router.post("/", uploadAvatar, photoController.addPhoto);
router.delete("/:id", photoController.removePhoto);
router.patch("/active", photoController.setActivePhoto);

export default router;

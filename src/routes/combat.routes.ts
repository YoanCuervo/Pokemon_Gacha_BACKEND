import { Router } from "express";
import { postCombat } from "../controllers/combat.controller";

/**
 * POST /api/combat — resout un combat et retourne le log complet.
 * POST et non GET : la resolution tire du random, deux appels ne
 * donnent pas la meme reponse — ce n'est pas une lecture cachable.
 */
const router = Router();

router.post("/", postCombat);

export default router;

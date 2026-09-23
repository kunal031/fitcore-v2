/**
 * `/api/v1/referrals`
 */
import { Router } from "express";

import { referralController } from "../controllers/index.js";
import { requireAuth, requireMember, requireOwner } from "../middleware/index.js";

export const referralRoutes = Router();

referralRoutes.use(requireAuth);

referralRoutes.get("/me", requireMember, referralController.getMyReferral);

referralRoutes.get("", requireOwner, referralController.listAll);

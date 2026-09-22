/**
 * `/api/v1/dashboard`
 *
 * The owner dashboard is owner-only; the trainer dashboard is open to both
 * staff roles, so an owner can see the floor view too.
 */
import { Router } from "express";

import { dashboardController } from "../controllers/index.js";
import { requireAuth, requireOwner, requireTrainerOrOwner } from "../middleware/index.js";

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);

dashboardRoutes.get("/owner", requireOwner, dashboardController.getOwnerDashboard);

dashboardRoutes.get(
  "/trainer",
  requireTrainerOrOwner,
  dashboardController.getTrainerDashboard,
);

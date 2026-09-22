/**
 * `/api/v1/dashboard`
 *
 * The owner dashboard is owner-only; the trainer dashboard is open to both
 * staff roles, so an owner can see the floor view too.
 */
import { Router } from "express";
import { z } from "zod";

import { dashboardController } from "../controllers/index.js";
import { MEMBER_COHORTS } from "../dtos/dashboard.dto.js";
import { validate } from "../middleware/index.js";
import { requireAuth, requireOwner, requireTrainerOrOwner } from "../middleware/index.js";

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);

dashboardRoutes.get("/owner", requireOwner, dashboardController.getOwnerDashboard);

// Membership and plan analytics. Owner only — it exposes the whole catalogue's
// performance, not just today's floor.
dashboardRoutes.get("/analytics", requireOwner, dashboardController.getAnalytics);

// The members behind one analytics figure. The cohort is validated against a
// fixed list, so an unknown value is a 422 rather than an empty result that
// looks like "nobody matches".
dashboardRoutes.get(
  "/analytics/members/:cohort",
  requireOwner,
  validate({ params: z.object({ cohort: z.enum(MEMBER_COHORTS) }) }),
  dashboardController.getMemberCohort,
);

dashboardRoutes.get(
  "/trainer",
  requireTrainerOrOwner,
  dashboardController.getTrainerDashboard,
);

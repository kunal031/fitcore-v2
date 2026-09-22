/** Dashboard HTTP handlers. */
import type { Request, Response } from "express";

import { asyncHandler } from "../middleware/index.js";
import { MEMBER_COHORTS, type MemberCohort } from "../dtos/dashboard.dto.js";
import { analyticsService, dashboardService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const dashboardController = {
  /** GET /dashboard/owner — revenue, membership and activity rollups. Owner only. */
  getOwnerDashboard: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await dashboardService.getOwnerDashboard()));
  }),

  /**
   * GET /dashboard/analytics — membership and plan analytics. Owner only.
   *
   * Heavier than the dashboard rollups, so it sits behind its own route
   * rather than inflating every dashboard load.
   */
  getAnalytics: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await analyticsService.getAnalytics()));
  }),

  /**
   * GET /dashboard/analytics/members/:cohort — the members behind one figure.
   *
   * Owner only, like the analytics it drills into.
   */
  getMemberCohort: asyncHandler(async (req: Request, res: Response) => {
    const cohort = req.params["cohort"] as MemberCohort;
    res.json(success(await analyticsService.getMemberCohort(cohort)));
  }),

  /** GET /dashboard/trainer — today's floor view. Trainer or owner. */
  getTrainerDashboard: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await dashboardService.getTrainerDashboard()));
  }),
};

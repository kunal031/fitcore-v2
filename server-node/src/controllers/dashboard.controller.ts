/** Dashboard HTTP handlers. */
import type { Request, Response } from "express";

import { asyncHandler } from "../middleware/index.js";
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

  /** GET /dashboard/trainer — today's floor view. Trainer or owner. */
  getTrainerDashboard: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await dashboardService.getTrainerDashboard()));
  }),
};

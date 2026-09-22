/** Dashboard HTTP handlers. */
import type { Request, Response } from "express";

import { asyncHandler } from "../middleware/index.js";
import { dashboardService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const dashboardController = {
  /** GET /dashboard/owner — revenue, membership and activity rollups. Owner only. */
  getOwnerDashboard: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await dashboardService.getOwnerDashboard()));
  }),

  /** GET /dashboard/trainer — today's floor view. Trainer or owner. */
  getTrainerDashboard: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await dashboardService.getTrainerDashboard()));
  }),
};

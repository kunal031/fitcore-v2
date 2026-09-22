/** Referral HTTP handlers. */
import type { Request, Response } from "express";

import { asyncHandler, currentUser } from "../middleware/index.js";
import { referralService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const referralController = {
  /** GET /referrals/me — Member only. Creates the record on first access. */
  getMyReferral: asyncHandler(async (req: Request, res: Response) => {
    res.json(success(await referralService.getMyReferral(currentUser(req))));
  }),

  /** GET /referrals — every referral record. Owner only. */
  listAll: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await referralService.listAllAdmin()));
  }),
};

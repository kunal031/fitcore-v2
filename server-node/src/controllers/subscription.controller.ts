/** Subscription HTTP handlers. */
import type { Request, Response } from "express";

import type { ExpiringQuery } from "../dtos/subscription.dto.js";
import { asyncHandler, currentUser } from "../middleware/index.js";
import { subscriptionService } from "../services/index.js";
import { emptyResult, success } from "../utils/apiResponse.js";

export const subscriptionController = {
  /**
   * GET /subscriptions/me
   *
   * A member with no active plan gets HTTP 200 with `success: false` and null
   * data rather than a 404 — "no subscription" is a normal state, not an
   * error, and the frontend renders it as the plan-purchase prompt.
   */
  getMyActive: asyncHandler(async (req: Request, res: Response) => {
    const data = await subscriptionService.getActiveSubscription(
      String(currentUser(req)._id),
    );

    if (!data) {
      res.json(emptyResult("No active subscription found."));
      return;
    }

    res.json(success(data));
  }),

  /** GET /subscriptions/me/history */
  getMyHistory: asyncHandler(async (req: Request, res: Response) => {
    const data = await subscriptionService.getHistory(
      String(currentUser(req)._id),
    );
    res.json(success(data));
  }),

  /** GET /subscriptions/expiring?days=7 — staff. Registered before /:subId. */
  getExpiring: asyncHandler(async (req: Request, res: Response) => {
    const { days } = req.query as unknown as ExpiringQuery;
    res.json(success(await subscriptionService.getExpiring(days)));
  }),

  /** GET /subscriptions/:subId — staff. */
  getById: asyncHandler(async (req: Request, res: Response) => {
    res.json(
      success(await subscriptionService.getById(req.params["subId"] as string)),
    );
  }),

  /** POST /subscriptions/:subId/pause — Owner only. */
  pause: asyncHandler(async (req: Request, res: Response) => {
    const data = await subscriptionService.pause(req.params["subId"] as string);
    res.json(success(data, "Subscription paused."));
  }),

  /** POST /subscriptions/:subId/resume — Owner only. */
  resume: asyncHandler(async (req: Request, res: Response) => {
    const data = await subscriptionService.resume(req.params["subId"] as string);
    res.json(success(data, "Subscription resumed."));
  }),

  /** POST /subscriptions/:subId/cancel — Owner only. */
  cancel: asyncHandler(async (req: Request, res: Response) => {
    const data = await subscriptionService.cancel(req.params["subId"] as string);
    res.json(success(data, "Subscription cancelled."));
  }),
};

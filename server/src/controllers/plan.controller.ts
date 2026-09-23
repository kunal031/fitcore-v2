/** Fitness plan HTTP handlers. */
import type { Request, Response } from "express";

import type { PlanCreateInput, PlanUpdateInput } from "../dtos/plan.dto.js";
import { asyncHandler } from "../middleware/index.js";
import { planService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const planController = {
  /** GET /plans — active plans, for any signed-in user. */
  listActive: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await planService.listActive()));
  }),

  /** GET /plans/all — includes archived. Owner only. Registered before /:planId. */
  listAll: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await planService.listAll()));
  }),

  /** POST /plans — 201. Owner only. */
  create: asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as PlanCreateInput;
    const data = await planService.create(payload);
    res
      .status(201)
      .json(success(data, `Plan '${payload.plan_name}' created successfully.`));
  }),

  /** GET /plans/:planId */
  getById: asyncHandler(async (req: Request, res: Response) => {
    res.json(success(await planService.getById(req.params["planId"] as string)));
  }),

  /** PATCH /plans/:planId — Owner only. */
  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await planService.update(
      req.params["planId"] as string,
      req.body as PlanUpdateInput,
    );
    res.json(success(data, "Plan updated successfully."));
  }),

  /** PATCH /plans/:planId/activate — restores a plan to the catalogue. */
  activate: asyncHandler(async (req: Request, res: Response) => {
    const data = await planService.setActive(req.params["planId"] as string, true);
    res.json(success(data, "Plan activated."));
  }),

  /** PATCH /plans/:planId/deactivate — archives it; existing subscriptions are unaffected. */
  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const data = await planService.setActive(req.params["planId"] as string, false);
    res.json(success(data, "Plan deactivated."));
  }),
};

/** Coupon HTTP handlers. */
import type { Request, Response } from "express";

import type {
  CouponCreateInput,
  CouponUpdateInput,
  ValidateCouponQuery,
} from "../dtos/coupon.dto.js";
import { ROLES } from "../config/constants.js";
import { asyncHandler, currentUser } from "../middleware/index.js";
import { couponService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const couponController = {
  /**
   * GET /coupons
   *
   * Staff get the full catalogue; members get only offers they could redeem
   * today, so expired and exhausted codes never reach the member UI.
   */
  listAll: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    const data =
      user.role === ROLES.MEMBER
        ? await couponService.listRedeemable()
        : await couponService.listAll();
    res.json(success(data));
  }),

  /** POST /coupons — 201. Owner only. */
  create: asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as CouponCreateInput;
    const data = await couponService.create(payload);
    res
      .status(201)
      .json(
        success(data, `Coupon '${payload.code.trim().toUpperCase()}' created successfully.`),
      );
  }),

  /**
   * GET /coupons/validate/:code?plan_id=... — any signed-in user.
   *
   * An unusable coupon is still HTTP 200: the result carries `valid: false`
   * and a `reason` for the checkout screen to display. Registered before
   * /:couponId so "validate" is not read as an id.
   */
  validate: asyncHandler(async (req: Request, res: Response) => {
    const { plan_id } = req.query as unknown as ValidateCouponQuery;
    const data = await couponService.validateCoupon(
      req.params["code"] as string,
      plan_id,
      String(currentUser(req)._id),
    );
    res.json(success(data));
  }),

  /** GET /coupons/:couponId — Owner only. */
  getById: asyncHandler(async (req: Request, res: Response) => {
    res.json(
      success(await couponService.getById(req.params["couponId"] as string)),
    );
  }),

  /** PATCH /coupons/:couponId — Owner only. Discount terms are immutable. */
  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await couponService.update(
      req.params["couponId"] as string,
      req.body as CouponUpdateInput,
    );
    res.json(success(data, "Coupon updated."));
  }),

  /** PATCH /coupons/:couponId/deactivate — Owner only. */
  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const data = await couponService.update(req.params["couponId"] as string, {
      is_active: false,
    });
    res.json(success(data, "Coupon deactivated."));
  }),
};

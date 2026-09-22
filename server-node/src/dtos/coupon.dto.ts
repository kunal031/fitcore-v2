/**
 * Coupon request/response schemas.
 *
 * Mirrors `server/app/schemas/coupon.py`.
 */
import { z } from "zod";

import { COUPON_APPLICABLE_ALL, DISCOUNT_TYPE } from "../config/constants.js";
import { dateTimeSchema, objectIdSchema } from "./common.dto.js";

export const couponCreateSchema = z.object({
  code: z.string().min(3).max(20),
  name: z.string().min(2).max(100),
  description: z.string().nullish(),
  discount_type: z
    .enum([DISCOUNT_TYPE.PERCENTAGE, DISCOUNT_TYPE.FLAT_PAISE])
    .default(DISCOUNT_TYPE.PERCENTAGE),
  /** Percent when `percentage`, paise when `flat_paise`. */
  discount_value: z.number().int().positive(),
  min_plan_price_paise: z.number().int().min(0).default(0),
  max_discount_paise: z.number().int().positive().nullish(),
  max_uses: z.number().int().positive().default(100),
  per_user_limit: z.number().int().positive().default(1),
  /** Plan ids, or `["all"]`. */
  applicable_to: z.array(z.string()).default([COUPON_APPLICABLE_ALL]),
  valid_from: dateTimeSchema.nullish(),
  valid_until: dateTimeSchema,
});
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;

/**
 * Coupon update.
 *
 * Discount terms are deliberately immutable: changing them would silently
 * alter the value of a code already in circulation.
 */
export const couponUpdateSchema = z.object({
  name: z.string().nullish(),
  description: z.string().nullish(),
  max_uses: z.number().int().positive().nullish(),
  per_user_limit: z.number().int().positive().nullish(),
  valid_until: dateTimeSchema.nullish(),
  is_active: z.boolean().nullish(),
});
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;

/** `GET /coupons/validate/:code?plan_id=...` */
export const validateCouponParamsSchema = z.object({
  code: z.string().min(1),
});
export const validateCouponQuerySchema = z.object({
  plan_id: objectIdSchema,
});
export type ValidateCouponQuery = z.infer<typeof validateCouponQuerySchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface CouponRead {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_plan_price_paise: number;
  max_discount_paise: number | null;
  max_uses: number;
  current_uses: number;
  per_user_limit: number;
  applicable_to: string[];
  valid_from: Date;
  valid_until: Date;
  is_active: boolean;
  created_at: Date;
}

/**
 * Validation result.
 *
 * An unusable coupon is NOT an error: the endpoint answers HTTP 200 with
 * `valid: false` and a human-readable `reason`. The frontend renders that
 * reason inline in the checkout drawer.
 */
export interface CouponValidationResponse {
  valid: boolean;
  code: string;
  discount_type: string | null;
  discount_value: number | null;
  discount_paise: number;
  original_paise: number;
  final_paise: number;
  description: string | null;
  reason: string | null;
}

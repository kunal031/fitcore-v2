/**
 * Coupon — a discount code applied at checkout.
 *
 * Usage is bounded three ways: a global `max_uses`, a `per_user_limit` counted
 * from successful payments, and a validity window. Percentage discounts can
 * additionally be capped with `max_discount_paise`.
 */
import { Schema, model, type HydratedDocument } from "mongoose";

import { COLLECTIONS, COUPON_APPLICABLE_ALL, DISCOUNT_TYPE } from "../config/constants.js";

export interface ICoupon {
  code: string;
  name: string;
  description: string | null;
  /** "percentage" | "flat_paise" */
  discount_type: string;
  /** Percent (e.g. 10) when percentage, otherwise paise (e.g. 20000 = ₹200). */
  discount_value: number;
  min_plan_price_paise: number;
  /** Ceiling for percentage discounts; ignored for flat discounts. */
  max_discount_paise: number | null;
  max_uses: number;
  current_uses: number;
  per_user_limit: number;
  /** Plan ids this coupon applies to, or `["all"]`. */
  applicable_to: string[];
  valid_from: Date;
  valid_until: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type CouponDoc = HydratedDocument<ICoupon>;

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    discount_type: { type: String, default: DISCOUNT_TYPE.PERCENTAGE },
    discount_value: { type: Number, required: true },
    min_plan_price_paise: { type: Number, default: 0 },
    max_discount_paise: { type: Number, default: null },
    max_uses: { type: Number, default: 100 },
    current_uses: { type: Number, default: 0 },
    per_user_limit: { type: Number, default: 1 },
    applicable_to: { type: [String], default: () => [COUPON_APPLICABLE_ALL] },
    valid_from: { type: Date, default: () => new Date() },
    valid_until: { type: Date, required: true },
    is_active: { type: Boolean, default: true },
  },
  {
    collection: COLLECTIONS.COUPONS,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false,
  },
);

// The nightly cleanup job sweeps active coupons past their validity date.
couponSchema.index({ is_active: 1, valid_until: 1 });

export const Coupon = model<ICoupon>("Coupon", couponSchema);

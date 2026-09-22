/**
 * Coupon queries.
 */
import type { Types } from "mongoose";

import { Coupon, type ICoupon, type CouponDoc } from "../models/Coupon.js";

export const couponRepository = {
  findById(id: Types.ObjectId | string): Promise<CouponDoc | null> {
    return Coupon.findById(id).exec();
  },

  /** Codes are stored uppercase; callers normalise before calling. */
  findByCode(code: string): Promise<CouponDoc | null> {
    return Coupon.findOne({ code }).exec();
  },

  findActiveByCode(code: string): Promise<CouponDoc | null> {
    return Coupon.findOne({ code, is_active: true }).exec();
  },

  listAll(): Promise<CouponDoc[]> {
    return Coupon.find().sort({ created_at: -1 }).exec();
  },

  create(data: Partial<ICoupon>): Promise<CouponDoc> {
    return Coupon.create(data);
  },

  /** Active coupons whose validity window has closed. Drives the cleanup job. */
  listExpiredActive(now: Date): Promise<CouponDoc[]> {
    return Coupon.find({ is_active: true, valid_until: { $lt: now } }).exec();
  },

  /**
   * Atomically increment a coupon's redemption count.
   *
   * Done as a `$inc` rather than read-modify-write so two simultaneous
   * checkouts cannot both read the same count and overwrite each other.
   */
  incrementUses(code: string): Promise<CouponDoc | null> {
    return Coupon.findOneAndUpdate(
      { code },
      { $inc: { current_uses: 1 }, $set: { updated_at: new Date() } },
      { new: true },
    ).exec();
  },
};

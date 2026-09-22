/**
 * Payment queries.
 */
import type { Types } from "mongoose";

import { PAYMENT_STATUS } from "../config/constants.js";
import { Payment, type IPayment, type PaymentDoc } from "../models/Payment.js";

export const paymentRepository = {
  findById(id: Types.ObjectId | string): Promise<PaymentDoc | null> {
    return Payment.findById(id).exec();
  },

  create(data: Partial<IPayment>): Promise<PaymentDoc> {
    return Payment.create(data);
  },

  listByUser(userId: Types.ObjectId | string): Promise<PaymentDoc[]> {
    return Payment.find({ user_id: userId }).sort({ created_at: -1 }).exec();
  },

  listAll(limit = 50): Promise<PaymentDoc[]> {
    return Payment.find().sort({ created_at: -1 }).limit(limit).exec();
  },

  /** Successful payments only — the basis for every revenue figure. */
  countSuccessfulByUser(userId: Types.ObjectId | string): Promise<number> {
    return Payment.countDocuments({
      user_id: userId,
      status: PAYMENT_STATUS.SUCCESS,
    }).exec();
  },

  /** How many times this user has already redeemed a given coupon. */
  countCouponUsesByUser(
    userId: Types.ObjectId | string,
    couponCode: string,
  ): Promise<number> {
    return Payment.countDocuments({
      user_id: userId,
      "coupon_details.code": couponCode,
      status: PAYMENT_STATUS.SUCCESS,
    }).exec();
  },

  /**
   * Total successful revenue in `[from, to)`, summed in the database.
   *
   * Returns paise. Replaces loading every payment document just to add them up.
   */
  async sumRevenueBetween(from: Date, to?: Date): Promise<number> {
    const createdAt: Record<string, Date> = { $gte: from };
    if (to) createdAt["$lt"] = to;

    const rows = await Payment.aggregate<{ total: number }>([
      { $match: { status: PAYMENT_STATUS.SUCCESS, created_at: createdAt } },
      { $group: { _id: null, total: { $sum: "$final_amount_paise" } } },
    ]).exec();

    return rows[0]?.total ?? 0;
  },

  listRecentSuccessful(limit = 5): Promise<PaymentDoc[]> {
    return Payment.find({ status: PAYMENT_STATUS.SUCCESS })
      .sort({ created_at: -1 })
      .limit(limit)
      .exec();
  },
};

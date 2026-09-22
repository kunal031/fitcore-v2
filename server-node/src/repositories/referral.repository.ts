/**
 * Referral queries.
 */
import type { Types } from "mongoose";

import { Referral, type IReferral, type ReferralDoc } from "../models/Referral.js";

export const referralRepository = {
  findByUserId(userId: Types.ObjectId | string): Promise<ReferralDoc | null> {
    return Referral.findOne({ referrer_user_id: userId }).exec();
  },

  findByCode(code: string): Promise<ReferralDoc | null> {
    return Referral.findOne({ referral_code: code }).exec();
  },

  findActiveByCode(code: string): Promise<ReferralDoc | null> {
    return Referral.findOne({ referral_code: code, is_active: true }).exec();
  },

  /** Used by seeding to avoid duplicating a record keyed either way. */
  findByUserIdOrCode(
    userId: Types.ObjectId | string,
    code: string,
  ): Promise<ReferralDoc | null> {
    return Referral.findOne({
      $or: [{ referrer_user_id: userId }, { referral_code: code }],
    }).exec();
  },

  create(data: Partial<IReferral>): Promise<ReferralDoc> {
    return Referral.create(data);
  },

  listAll(): Promise<ReferralDoc[]> {
    return Referral.find().sort({ created_at: -1 }).exec();
  },
};

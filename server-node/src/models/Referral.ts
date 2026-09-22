/**
 * Referral — one document per member, holding their code and everyone who
 * signed up with it.
 *
 * The referrer earns loyalty points; the referee gets a discount on their
 * first purchase. Rewards are issued at payment verification, not at signup,
 * and `reward_issued` guards against paying out twice.
 */
import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { COLLECTIONS, DISCOUNT_TYPE } from "../config/constants.js";

export interface ReferredMember {
  user_id: Types.ObjectId;
  full_name: string;
  joined_on: Date;
  has_purchased: boolean;
  reward_issued: boolean;
}

export interface IReferral {
  referrer_user_id: Types.ObjectId;
  referral_code: string;
  referrer_reward_type: string;
  /** Loyalty points awarded to the referrer per conversion. */
  referrer_reward_value: number;
  referee_discount_type: string;
  /** Discount in paise for the referee's first purchase. */
  referee_discount_value: number;
  total_referrals: number;
  successful_conversions: number;
  referred_members: ReferredMember[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type ReferralDoc = HydratedDocument<IReferral>;

const referredMemberSchema = new Schema<ReferredMember>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true },
    full_name: { type: String, required: true },
    joined_on: { type: Date, default: () => new Date() },
    has_purchased: { type: Boolean, default: false },
    reward_issued: { type: Boolean, default: false },
  },
  { _id: false },
);

const referralSchema = new Schema<IReferral>(
  {
    referrer_user_id: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    referral_code: { type: String, required: true, unique: true, index: true },
    referrer_reward_type: { type: String, default: "loyalty_points" },
    referrer_reward_value: { type: Number, default: 500 },
    referee_discount_type: { type: String, default: DISCOUNT_TYPE.FLAT_PAISE },
    referee_discount_value: { type: Number, default: 20000 },
    total_referrals: { type: Number, default: 0 },
    successful_conversions: { type: Number, default: 0 },
    referred_members: { type: [referredMemberSchema], default: () => [] },
    is_active: { type: Boolean, default: true },
  },
  {
    collection: COLLECTIONS.REFERRALS,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false,
  },
);

export const Referral = model<IReferral>("Referral", referralSchema);

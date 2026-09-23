/**
 * Payment — one record per checkout attempt, successful or not.
 *
 * Created in `pending` state when checkout is initiated and moved to `success`
 * only after verification, which is also when the subscription is created and
 * the coupon's use count is incremented.
 */
import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { COLLECTIONS, PAYMENT_METHOD, PAYMENT_STATUS } from "../config/constants.js";

export interface PaymentCouponDetails {
  code: string;
  discount_paise: number;
}

export interface PaymentReferralDetails {
  code: string;
  discount_paise: number;
}

export interface IPayment {
  user_id: Types.ObjectId;
  plan_id: Types.ObjectId;
  receipt_number: string;
  /** Plan list price before any discount. */
  amount_paise: number;
  /** Coupon + referral discount combined. */
  discount_paise: number;
  /** What the member actually pays. */
  final_amount_paise: number;
  payment_method: string;
  status: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  coupon_details: PaymentCouponDetails | null;
  referral_details: PaymentReferralDetails | null;
  note: string | null;
  /** Set for manual (cash/UPI) payments: the staff member who recorded it. */
  recorded_by: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export type PaymentDoc = HydratedDocument<IPayment>;

const couponDetailsSchema = new Schema<PaymentCouponDetails>(
  {
    code: { type: String, required: true },
    discount_paise: { type: Number, required: true },
  },
  { _id: false },
);

const referralDetailsSchema = new Schema<PaymentReferralDetails>(
  {
    code: { type: String, required: true },
    discount_paise: { type: Number, required: true },
  },
  { _id: false },
);

const paymentSchema = new Schema<IPayment>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, index: true },
    plan_id: { type: Schema.Types.ObjectId, required: true },
    receipt_number: { type: String, required: true, unique: true, index: true },
    amount_paise: { type: Number, required: true },
    discount_paise: { type: Number, default: 0 },
    final_amount_paise: { type: Number, required: true },
    payment_method: { type: String, default: PAYMENT_METHOD.RAZORPAY },
    status: { type: String, default: PAYMENT_STATUS.PENDING, index: true },
    gateway_order_id: { type: String, default: null },
    gateway_payment_id: { type: String, default: null },
    gateway_signature: { type: String, default: null },
    coupon_details: { type: couponDetailsSchema, default: null },
    referral_details: { type: referralDetailsSchema, default: null },
    note: { type: String, default: null },
    recorded_by: { type: Schema.Types.ObjectId, default: null },
  },
  {
    collection: COLLECTIONS.PAYMENTS,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false,
  },
);

// Revenue aggregation for the owner dashboard.
paymentSchema.index({ status: 1, created_at: -1 });
// Per-user coupon usage counting during validation.
paymentSchema.index({ user_id: 1, "coupon_details.code": 1, status: 1 });

export const Payment = model<IPayment>("Payment", paymentSchema);

/**
 * Payment request/response schemas.
 *
 * Mirrors `server/app/schemas/payment.py`.
 */
import { z } from "zod";

import { PAYMENT_METHOD } from "../config/constants.js";
import { objectIdSchema } from "./common.dto.js";

export const initiatePaymentSchema = z.object({
  plan_id: objectIdSchema,
  coupon_code: z.string().nullish(),
  referral_code: z.string().nullish(),
});
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;

export const verifyPaymentSchema = z.object({
  payment_id: objectIdSchema,
  razorpay_payment_id: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

/** Cash or UPI taken at the desk and recorded by staff. */
export const manualPaymentSchema = z.object({
  member_id: objectIdSchema,
  plan_id: objectIdSchema,
  payment_method: z
    .enum([PAYMENT_METHOD.CASH, PAYMENT_METHOD.UPI])
    .default(PAYMENT_METHOD.CASH),
  amount_paise: z.number().int().positive(),
  upi_ref: z.string().nullish(),
  coupon_code: z.string().nullish(),
  note: z.string().nullish(),
});
export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface DiscountBreakdown {
  original_paise: number;
  coupon_discount_paise: number;
  referral_discount_paise: number;
  final_paise: number;
}

export interface PaymentPrefill {
  name: string;
  contact: string;
}

export interface InitiatePaymentResponse {
  payment_id: string;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount_paise: number;
  currency: string;
  discount_breakdown: DiscountBreakdown;
  prefill: PaymentPrefill;
}

export interface PaymentRead {
  id: string;
  user_id: string;
  plan_id: string;
  receipt_number: string;
  amount_paise: number;
  discount_paise: number;
  final_amount_paise: number;
  /** Pre-formatted for display, e.g. "₹1,500.00". */
  amount_paid_inr: string;
  payment_method: string;
  status: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  note: string | null;
  created_at: Date;
}

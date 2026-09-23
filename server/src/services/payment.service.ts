/**
 * Checkout and payment processing.
 *
 * Mirrors `server/app/services/payment_service.py`.
 *
 * A purchase runs in two steps. `initiateCheckout` prices the plan, applies
 * discounts and records a `pending` payment; `verifyPayment` confirms the
 * gateway result and only then creates the subscription, burns the coupon and
 * pays out any referral reward. Nothing is granted until money is confirmed.
 *
 * Staff can also record cash or UPI taken at the desk, which skips the gateway
 * entirely and activates the plan immediately.
 */
import { PAYMENT_METHOD, PAYMENT_STATUS } from "../config/constants.js";
import { settings } from "../config/env.js";
import type {
  InitiatePaymentInput,
  InitiatePaymentResponse,
  ManualPaymentInput,
  PaymentRead,
  VerifyPaymentInput,
} from "../dtos/payment.dto.js";
import {
  NotFoundError,
  PaymentError,
  ValidationError,
} from "../errors/index.js";
import type { UserDoc } from "../models/User.js";
import {
  couponRepository,
  paymentRepository,
  planRepository,
  referralRepository,
  userRepository,
} from "../repositories/index.js";
import { generateReceiptNumber } from "../utils/generators.js";
import { toObjectId } from "../utils/objectId.js";
import { couponService } from "./coupon.service.js";
import { toPaymentRead } from "./mappers/index.js";
import { razorpayService } from "./razorpay.service.js";
import { referralService } from "./referral.service.js";
import { subscriptionService } from "./subscription.service.js";

export const paymentService = {
  /**
   * Price a checkout and open a gateway order.
   *
   * Discounts stack in a fixed order — coupon first, then referral — and the
   * referral amount is capped by what is left after the coupon, so the two
   * together can never exceed the plan price.
   */
  async initiateCheckout(
    user: UserDoc,
    payload: InitiatePaymentInput,
  ): Promise<InitiatePaymentResponse> {
    const plan = await planRepository.findById(
      toObjectId(payload.plan_id, "Selected plan not found or is inactive", "PLAN_NOT_FOUND"),
    );
    if (!plan || !plan.is_active) {
      throw new NotFoundError(
        "Selected plan not found or is inactive",
        "PLAN_NOT_FOUND",
      );
    }

    const originalPaise = plan.price_paise;

    // ── Coupon discount ────────────────────────────────────────────────────
    // Unlike the validate endpoint, an invalid coupon here is a hard error:
    // the member explicitly chose to apply it to this purchase.
    let couponDiscount = 0;
    let couponCode: string | null = null;
    if (payload.coupon_code) {
      const result = await couponService.validateCoupon(
        payload.coupon_code,
        String(plan._id),
        String(user._id),
      );
      if (!result.valid) {
        throw new ValidationError(
          result.reason ?? "Invalid coupon code",
          "INVALID_COUPON",
          "coupon_code",
        );
      }
      couponDiscount = result.discount_paise;
      couponCode = result.code;
    }

    // ── Referral discount ──────────────────────────────────────────────────
    // First purchase only, so a member cannot re-apply a referral code to
    // every renewal.
    let referralDiscount = 0;
    let referralCode: string | null = null;
    if (payload.referral_code) {
      referralCode = payload.referral_code.trim().toUpperCase();
      const referralDoc = await referralRepository.findActiveByCode(referralCode);
      if (referralDoc) {
        const pastPayments = await paymentRepository.countSuccessfulByUser(user._id);
        if (pastPayments === 0) {
          referralDiscount = Math.min(
            referralDoc.referee_discount_value,
            originalPaise - couponDiscount,
          );
        }
      }
    }

    const totalDiscount = couponDiscount + referralDiscount;
    const finalPaise = Math.max(0, originalPaise - totalDiscount);
    const receiptNumber = generateReceiptNumber();

    const gatewayOrderId = await razorpayService.createOrder({
      amountPaise: finalPaise,
      receipt: receiptNumber,
    });

    // Recorded as `pending`; nothing is granted until verification.
    const payment = await paymentRepository.create({
      user_id: user._id,
      plan_id: plan._id,
      receipt_number: receiptNumber,
      amount_paise: originalPaise,
      discount_paise: totalDiscount,
      final_amount_paise: finalPaise,
      payment_method: PAYMENT_METHOD.RAZORPAY,
      status: PAYMENT_STATUS.PENDING,
      gateway_order_id: gatewayOrderId,
      coupon_details: couponCode
        ? { code: couponCode, discount_paise: couponDiscount }
        : null,
      referral_details: referralCode
        ? { code: referralCode, discount_paise: referralDiscount }
        : null,
    });

    return {
      payment_id: String(payment._id),
      razorpay_order_id: gatewayOrderId,
      razorpay_key_id: settings.RAZORPAY_KEY_ID,
      amount_paise: finalPaise,
      currency: "INR",
      discount_breakdown: {
        original_paise: originalPaise,
        coupon_discount_paise: couponDiscount,
        referral_discount_paise: referralDiscount,
        final_paise: finalPaise,
      },
      prefill: {
        name: user.full_name,
        contact: user.phone,
      },
    };
  },

  /**
   * Confirm a gateway payment and grant everything it bought.
   *
   * Idempotent: a payment already marked successful is returned unchanged
   * rather than creating a second subscription, so a retried or duplicated
   * callback is harmless.
   */
  async verifyPayment(
    user: UserDoc,
    payload: VerifyPaymentInput,
  ): Promise<PaymentRead> {
    const payment = await paymentRepository.findById(
      toObjectId(payload.payment_id, "Payment record not found", "PAYMENT_NOT_FOUND"),
    );
    if (!payment) {
      throw new NotFoundError("Payment record not found", "PAYMENT_NOT_FOUND");
    }

    if (String(payment.user_id) !== String(user._id)) {
      throw new PaymentError(
        "You cannot verify another user's payment.",
        "PAYMENT_FORBIDDEN",
      );
    }

    if (payment.gateway_order_id !== payload.razorpay_order_id) {
      throw new PaymentError(
        "Payment order does not match the payment record.",
        "ORDER_MISMATCH",
      );
    }

    // Already settled — return it rather than granting the plan twice.
    if (payment.status === PAYMENT_STATUS.SUCCESS) {
      return toPaymentRead(payment);
    }

    const signatureValid = razorpayService.verifySignature(
      payload.razorpay_order_id,
      payload.razorpay_payment_id,
      payload.razorpay_signature,
    );
    if (!signatureValid) {
      payment.status = PAYMENT_STATUS.FAILED;
      await payment.save();
      throw new PaymentError(
        "Payment signature verification failed.",
        "SIGNATURE_MISMATCH",
      );
    }

    payment.status = PAYMENT_STATUS.SUCCESS;
    payment.gateway_payment_id = payload.razorpay_payment_id;
    payment.gateway_signature = payload.razorpay_signature;
    await payment.save();

    // Grant the plan.
    await subscriptionService.createSubscription(
      user._id,
      payment.plan_id,
      payment._id,
    );

    // Burn the coupon. Counted here, not at initiation, so an abandoned
    // checkout does not consume a redemption.
    if (payment.coupon_details) {
      await couponRepository.incrementUses(payment.coupon_details.code);
    }

    // Credit the referrer.
    if (payment.referral_details) {
      await referralService.issueRewardOnPurchase(
        user._id,
        payment.referral_details.code,
      );
    }

    return toPaymentRead(payment);
  },

  /**
   * Record a cash or UPI payment taken at the desk, and activate the plan.
   *
   * The amount is whatever staff actually collected; any shortfall against the
   * list price is stored as the discount, which is how counter negotiations and
   * part payments are represented.
   */
  async recordManualPayment(
    staffUser: UserDoc,
    payload: ManualPaymentInput,
  ): Promise<PaymentRead> {
    const member = await userRepository.findById(
      toObjectId(payload.member_id, "Member not found", "MEMBER_NOT_FOUND"),
    );
    if (!member) {
      throw new NotFoundError("Member not found", "MEMBER_NOT_FOUND");
    }

    const plan = await planRepository.findById(
      toObjectId(payload.plan_id, "Plan not found", "PLAN_NOT_FOUND"),
    );
    if (!plan) {
      throw new NotFoundError("Plan not found", "PLAN_NOT_FOUND");
    }

    const payment = await paymentRepository.create({
      user_id: member._id,
      plan_id: plan._id,
      receipt_number: generateReceiptNumber(),
      amount_paise: plan.price_paise,
      discount_paise: Math.max(0, plan.price_paise - payload.amount_paise),
      final_amount_paise: payload.amount_paise,
      payment_method: payload.payment_method,
      status: PAYMENT_STATUS.SUCCESS,
      gateway_payment_id: payload.upi_ref ?? null,
      note: payload.note ?? null,
      recorded_by: staffUser._id,
    });

    // No gateway round trip: the money is already in hand.
    await subscriptionService.createSubscription(
      member._id,
      plan._id,
      payment._id,
    );

    return toPaymentRead(payment);
  },

  async getMyPayments(userId: string): Promise<PaymentRead[]> {
    const payments = await paymentRepository.listByUser(userId);
    return payments.map(toPaymentRead);
  },

  /** All payments, newest first. Owner only. Capped to keep the response small. */
  async listAllPayments(limit = 50): Promise<PaymentRead[]> {
    const payments = await paymentRepository.listAll(limit);
    return payments.map(toPaymentRead);
  },
};

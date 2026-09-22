/**
 * Coupon management and validation.
 *
 * Mirrors `server/app/services/coupon_service.py`.
 *
 * Validation deliberately does NOT throw for an unusable coupon: it answers
 * with `valid: false` and a human-readable `reason`, which the checkout screen
 * renders inline. Only a genuinely broken request produces an error status.
 */
import { COUPON_APPLICABLE_ALL, DISCOUNT_TYPE } from "../config/constants.js";
import type {
  CouponCreateInput,
  CouponRead,
  CouponUpdateInput,
  CouponValidationResponse,
} from "../dtos/coupon.dto.js";
import { ConflictError, NotFoundError } from "../errors/index.js";
import type { CouponDoc } from "../models/Coupon.js";
import type { PlanDoc } from "../models/Plan.js";
import {
  couponRepository,
  paymentRepository,
  planRepository,
} from "../repositories/index.js";
import { getUtcNow } from "../utils/date.js";
import { clampDiscount, paiseToInr, percentageDiscount } from "../utils/money.js";
import { isValidObjectId } from "../utils/objectId.js";
import { toCouponRead } from "./mappers/index.js";

/** Build a rejection result carrying the reason to show the member. */
function invalid(code: string, reason: string): CouponValidationResponse {
  return {
    valid: false,
    code,
    discount_type: null,
    discount_value: null,
    discount_paise: 0,
    original_paise: 0,
    final_paise: 0,
    description: null,
    reason,
  };
}

/**
 * Compute the discount a coupon grants on a plan, in paise.
 *
 * Percentage discounts are truncated to whole paise and capped by
 * `max_discount_paise` when set; flat discounts are capped at the plan price
 * so a large coupon on a cheap plan can never produce a negative total.
 */
export function calculateDiscountPaise(coupon: CouponDoc, plan: PlanDoc): number {
  if (coupon.discount_type === DISCOUNT_TYPE.PERCENTAGE) {
    const discount = percentageDiscount(plan.price_paise, coupon.discount_value);
    return coupon.max_discount_paise
      ? Math.min(discount, coupon.max_discount_paise)
      : discount;
  }
  return clampDiscount(coupon.discount_value, plan.price_paise);
}

export const couponService = {
  async listAll(): Promise<CouponRead[]> {
    const coupons = await couponRepository.listAll();
    return coupons.map(toCouponRead);
  },

  /**
   * Offers a member could redeem right now.
   *
   * Staff see the full catalogue through `listAll`, including expired and
   * exhausted codes they may still need to explain. Members only want what
   * works today, so this drops anything inactive, outside its validity window
   * or at its global usage cap.
   *
   * Per-member limits are deliberately not applied here: that check needs a
   * plan to price against, and validation at checkout already enforces it.
   */
  async listRedeemable(): Promise<CouponRead[]> {
    const now = getUtcNow();
    const coupons = await couponRepository.listAll();

    return coupons
      .filter(
        (coupon) =>
          coupon.is_active &&
          coupon.valid_from <= now &&
          coupon.valid_until >= now &&
          coupon.current_uses < coupon.max_uses,
      )
      .map(toCouponRead);
  },

  async getById(couponId: string): Promise<CouponRead> {
    const coupon = await couponRepository.findById(couponId);
    if (!coupon) {
      throw new NotFoundError("Coupon not found", "COUPON_NOT_FOUND");
    }
    return toCouponRead(coupon);
  },

  /** Create a coupon. Codes are stored uppercase and must be unique. */
  async create(payload: CouponCreateInput): Promise<CouponRead> {
    const cleanCode = payload.code.trim().toUpperCase();

    if (await couponRepository.findByCode(cleanCode)) {
      throw new ConflictError(
        `Coupon code '${cleanCode}' already exists.`,
        "COUPON_CODE_EXISTS",
      );
    }

    const coupon = await couponRepository.create({
      code: cleanCode,
      name: payload.name,
      description: payload.description ?? null,
      discount_type: payload.discount_type,
      discount_value: payload.discount_value,
      min_plan_price_paise: payload.min_plan_price_paise,
      max_discount_paise: payload.max_discount_paise ?? null,
      max_uses: payload.max_uses,
      per_user_limit: payload.per_user_limit,
      applicable_to: payload.applicable_to,
      valid_from: payload.valid_from ?? getUtcNow(),
      valid_until: payload.valid_until,
      is_active: true,
    });

    return toCouponRead(coupon);
  },

  /**
   * Update a coupon's presentation and limits.
   *
   * The discount terms themselves are not updatable: changing them would alter
   * the value of a code already circulating among members.
   */
  async update(couponId: string, payload: CouponUpdateInput): Promise<CouponRead> {
    const coupon = await couponRepository.findById(couponId);
    if (!coupon) {
      throw new NotFoundError("Coupon not found", "COUPON_NOT_FOUND");
    }

    if (payload.name != null) coupon.name = payload.name;
    if (payload.description != null) coupon.description = payload.description;
    if (payload.max_uses != null) coupon.max_uses = payload.max_uses;
    if (payload.per_user_limit != null) coupon.per_user_limit = payload.per_user_limit;
    if (payload.valid_until != null) coupon.valid_until = payload.valid_until;
    if (payload.is_active != null) coupon.is_active = payload.is_active;

    await coupon.save();
    return toCouponRead(coupon);
  },

  /**
   * Check whether a code may be applied to a plan by a given member, and work
   * out what it is worth.
   *
   * The checks run cheapest-first and each returns its own reason:
   *   existence and active flag, validity window, global usage cap, the plan
   *   itself, the plan's minimum price, plan targeting, then the member's own
   *   usage of this code.
   */
  async validateCoupon(
    code: string,
    planId: string,
    userId?: string,
  ): Promise<CouponValidationResponse> {
    const cleanCode = code.trim().toUpperCase();

    const coupon = await couponRepository.findActiveByCode(cleanCode);
    if (!coupon) {
      return invalid(cleanCode, "Coupon code does not exist or is inactive.");
    }

    const now = getUtcNow();
    if (now < coupon.valid_from) {
      return invalid(cleanCode, "Coupon is not yet active.");
    }
    if (now > coupon.valid_until) {
      return invalid(cleanCode, "Coupon has expired.");
    }
    if (coupon.current_uses >= coupon.max_uses) {
      return invalid(
        cleanCode,
        "Coupon has reached its maximum global usage limit.",
      );
    }

    const plan = isValidObjectId(planId)
      ? await planRepository.findById(planId)
      : null;
    if (!plan) {
      return invalid(cleanCode, "Selected plan not found.");
    }

    if (plan.price_paise < coupon.min_plan_price_paise) {
      return invalid(
        cleanCode,
        `Plan price must be at least ${paiseToInr(coupon.min_plan_price_paise)} to use this coupon.`,
      );
    }

    // `["all"]` means every plan; otherwise the plan id must be listed.
    const appliesToPlan =
      coupon.applicable_to.includes(COUPON_APPLICABLE_ALL) ||
      coupon.applicable_to.includes(String(plan._id));
    if (!appliesToPlan) {
      return invalid(
        cleanCode,
        "This coupon is not applicable to the selected plan.",
      );
    }

    // Per-member usage is counted from successful payments, so an abandoned
    // checkout never consumes an allowance.
    if (userId) {
      const userUses = await paymentRepository.countCouponUsesByUser(
        userId,
        cleanCode,
      );
      if (userUses >= coupon.per_user_limit) {
        return invalid(
          cleanCode,
          "You have already used this coupon the maximum allowed times.",
        );
      }
    }

    const discountPaise = calculateDiscountPaise(coupon, plan);

    return {
      valid: true,
      code: cleanCode,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_paise: discountPaise,
      original_paise: plan.price_paise,
      final_paise: Math.max(0, plan.price_paise - discountPaise),
      description: coupon.description ?? null,
      reason: null,
    };
  },
};

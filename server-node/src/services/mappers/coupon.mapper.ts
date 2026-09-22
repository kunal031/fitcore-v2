/** Document -> response mapping for coupons. */
import type { CouponDoc } from "../../models/Coupon.js";
import type { CouponRead } from "../../dtos/coupon.dto.js";

export function toCouponRead(coupon: CouponDoc): CouponRead {
  return {
    id: String(coupon._id),
    code: coupon.code,
    name: coupon.name,
    description: coupon.description ?? null,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    min_plan_price_paise: coupon.min_plan_price_paise,
    max_discount_paise: coupon.max_discount_paise ?? null,
    max_uses: coupon.max_uses,
    current_uses: coupon.current_uses,
    per_user_limit: coupon.per_user_limit,
    applicable_to: coupon.applicable_to ?? [],
    valid_from: coupon.valid_from,
    valid_until: coupon.valid_until,
    is_active: coupon.is_active,
    created_at: coupon.created_at,
  };
}

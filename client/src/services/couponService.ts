import { api } from "../lib/axios";

export interface Coupon {
	id: string;
	code: string;
	name: string;
	description?: string | null;
	discount_type: string;
	discount_value: number;
	min_plan_price_paise: number;
	max_discount_paise?: number | null;
	max_uses: number;
	current_uses: number;
	per_user_limit: number;
	applicable_to: string[];
	valid_from: string;
	valid_until: string;
	is_active: boolean;
	created_at: string;
}

/**
 * The backend answers validation with HTTP 200 even when the coupon is
 * unusable: `valid` is false and `reason` carries the explanation.
 */
export interface CouponValidation {
	valid: boolean;
	code: string;
	discount_type?: string | null;
	discount_value?: number | null;
	discount_paise: number;
	original_paise: number;
	final_paise: number;
	description?: string | null;
	reason?: string | null;
}

export interface CouponCreatePayload {
	code: string;
	name: string;
	description?: string;
	discount_type: string;
	discount_value: number;
	min_plan_price_paise: number;
	max_discount_paise?: number | null;
	max_uses: number;
	per_user_limit: number;
	applicable_to: string[];
	valid_until: string;
}

export interface CouponUpdatePayload {
	name?: string;
	description?: string;
	max_uses?: number;
	per_user_limit?: number;
	valid_until?: string;
	is_active?: boolean;
}

export async function validateCoupon(code: string, planId: string) {
	const response = await api.get<{ data: CouponValidation }>(
		`/coupons/validate/${encodeURIComponent(code.trim().toUpperCase())}`,
		{ params: { plan_id: planId } },
	);
	return response.data.data;
}

export async function getCoupons() {
	const response = await api.get<{ data: Coupon[] }>("/coupons");
	return response.data.data ?? [];
}

export async function createCoupon(payload: CouponCreatePayload) {
	const response = await api.post<{ data: Coupon }>("/coupons", payload);
	return response.data.data;
}

export async function updateCoupon(couponId: string, payload: CouponUpdatePayload) {
	const response = await api.patch<{ data: Coupon }>(`/coupons/${couponId}`, payload);
	return response.data.data;
}

export async function setCouponActive(couponId: string, isActive: boolean) {
	return updateCoupon(couponId, { is_active: isActive });
}

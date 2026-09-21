import { api } from "../lib/axios";

export interface PaymentInitiation {
	payment_id: string;
	razorpay_order_id: string;
	razorpay_key_id: string;
	amount_paise: number;
	currency: string;
	discount_breakdown: {
		original_paise: number;
		coupon_discount_paise: number;
		referral_discount_paise: number;
		final_paise: number;
	};
	prefill: { name: string; contact: string };
}

export interface PaymentRecord {
	id: string;
	receipt_number: string;
	amount_paise: number;
	discount_paise: number;
	final_amount_paise: number;
	amount_paid_inr: string;
	payment_method: string;
	status: string;
	created_at: string;
}

export async function initiatePayment(planId: string, couponCode?: string) {
	const response = await api.post<{ data: PaymentInitiation }>("/payments/initiate", {
		plan_id: planId,
		coupon_code: couponCode || undefined,
	});
	return response.data.data;
}

export async function verifyMockPayment(payment: PaymentInitiation) {
	const response = await api.post<{ data: PaymentRecord }>("/payments/verify", {
		payment_id: payment.payment_id,
		razorpay_payment_id: `mock_payment_${payment.payment_id.slice(-8)}`,
		razorpay_order_id: payment.razorpay_order_id,
		razorpay_signature: "mock_signature",
	});
	return response.data.data;
}

export interface PaymentDetail extends PaymentRecord {
	user_id: string;
	plan_id: string;
	gateway_order_id?: string | null;
	gateway_payment_id?: string | null;
	note?: string | null;
}

export async function getMyPayments() {
	const response = await api.get<{ data: PaymentDetail[] }>("/payments/me");
	return response.data.data ?? [];
}

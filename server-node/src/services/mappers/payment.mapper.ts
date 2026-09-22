/**
 * Document -> response mapping for payments.
 *
 * `amount_paid_inr` is formatted here so the frontend never divides by 100.
 * The gateway signature is deliberately not exposed.
 */
import type { PaymentDoc } from "../../models/Payment.js";
import type { PaymentRead } from "../../dtos/payment.dto.js";
import { paiseToInr } from "../../utils/money.js";

export function toPaymentRead(payment: PaymentDoc): PaymentRead {
  return {
    id: String(payment._id),
    user_id: String(payment.user_id),
    plan_id: String(payment.plan_id),
    receipt_number: payment.receipt_number,
    amount_paise: payment.amount_paise,
    discount_paise: payment.discount_paise,
    final_amount_paise: payment.final_amount_paise,
    amount_paid_inr: paiseToInr(payment.final_amount_paise),
    payment_method: payment.payment_method,
    status: payment.status,
    gateway_order_id: payment.gateway_order_id ?? null,
    gateway_payment_id: payment.gateway_payment_id ?? null,
    note: payment.note ?? null,
    created_at: payment.created_at,
  };
}

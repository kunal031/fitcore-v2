from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class DiscountBreakdown(BaseModel):
    original_paise: int
    coupon_discount_paise: int = 0
    referral_discount_paise: int = 0
    final_paise: int


class PaymentPrefill(BaseModel):
    name: str
    contact: str


class InitiatePaymentRequest(BaseModel):
    plan_id: str
    coupon_code: Optional[str] = None
    referral_code: Optional[str] = None


class InitiatePaymentResponse(BaseModel):
    payment_id: str
    razorpay_order_id: str
    razorpay_key_id: str
    amount_paise: int
    currency: str = "INR"
    discount_breakdown: DiscountBreakdown
    prefill: PaymentPrefill


class VerifyPaymentRequest(BaseModel):
    payment_id: str
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class ManualPaymentRequest(BaseModel):
    member_id: str
    plan_id: str
    payment_method: str = "cash"  # "cash" | "upi"
    amount_paise: int = Field(..., gt=0)
    upi_ref: Optional[str] = None
    coupon_code: Optional[str] = None
    note: Optional[str] = None


class PaymentRead(BaseModel):
    id: str
    user_id: str
    plan_id: str
    receipt_number: str
    amount_paise: int
    discount_paise: int
    final_amount_paise: int
    amount_paid_inr: str
    payment_method: str
    status: str
    gateway_order_id: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

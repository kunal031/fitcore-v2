from datetime import datetime
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field

from app.utils.date_utils import get_utc_now


class PaymentCouponDetails(BaseModel):
    code: str
    discount_paise: int


class PaymentReferralDetails(BaseModel):
    code: str
    discount_paise: int


class PaymentDocument(Document):
    user_id: Indexed(PydanticObjectId)
    plan_id: PydanticObjectId

    receipt_number: Indexed(str, unique=True)
    amount_paise: int
    discount_paise: int = 0
    final_amount_paise: int

    payment_method: str = "razorpay"  # "razorpay" | "cash" | "upi"
    status: Indexed(str) = "pending"  # "pending" | "success" | "failed" | "refunded"

    gateway_order_id: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    gateway_signature: Optional[str] = None

    coupon_details: Optional[PaymentCouponDetails] = None
    referral_details: Optional[PaymentReferralDetails] = None

    note: Optional[str] = None
    recorded_by: Optional[PydanticObjectId] = None

    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    class Settings:
        name = "payments"
        use_state_management = True

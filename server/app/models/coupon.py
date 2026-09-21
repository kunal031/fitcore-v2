from datetime import datetime
from typing import List, Optional

from beanie import Document, Indexed
from pydantic import Field

from app.utils.date_utils import get_utc_now


class CouponDocument(Document):
    code: Indexed(str, unique=True)
    name: str
    description: Optional[str] = None

    discount_type: str = "percentage"  # "percentage" | "flat_paise"
    discount_value: int  # e.g. 10 for 10% OR 20000 for ₹200 flat in paise
    min_plan_price_paise: int = 0
    max_discount_paise: Optional[int] = None  # Cap for percentage discounts

    max_uses: int = 100
    current_uses: int = 0
    per_user_limit: int = 1
    applicable_to: List[str] = Field(default_factory=lambda: ["all"])

    valid_from: datetime = Field(default_factory=get_utc_now)
    valid_until: datetime

    is_active: bool = True
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    class Settings:
        name = "coupons"
        use_state_management = True

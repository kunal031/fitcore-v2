from datetime import datetime
from typing import List

from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field

from app.utils.date_utils import get_utc_now


class ReferredMember(BaseModel):
    user_id: PydanticObjectId
    full_name: str
    joined_on: datetime = Field(default_factory=get_utc_now)
    has_purchased: bool = False
    reward_issued: bool = False


class ReferralDocument(Document):
    referrer_user_id: Indexed(PydanticObjectId, unique=True)
    referral_code: Indexed(str, unique=True)

    referrer_reward_type: str = "loyalty_points"
    referrer_reward_value: int = 500  # 500 points
    referee_discount_type: str = "flat_paise"
    referee_discount_value: int = 20000  # ₹200 off on first plan

    total_referrals: int = 0
    successful_conversions: int = 0
    referred_members: List[ReferredMember] = Field(default_factory=list)

    is_active: bool = True
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    class Settings:
        name = "referrals"
        use_state_management = True

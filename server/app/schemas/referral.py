from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class ReferredMemberRead(BaseModel):
    user_id: str
    full_name: str
    joined_on: datetime
    has_purchased: bool
    reward_issued: bool


class ReferralRewardInfo(BaseModel):
    type: str
    value: int


class ReferralStats(BaseModel):
    total_referrals: int
    successful_joins: int
    total_points_earned: int


class ReferralRead(BaseModel):
    my_referral_code: str
    shareable_link: str
    referrer_reward: ReferralRewardInfo
    referee_reward: ReferralRewardInfo
    stats: ReferralStats
    referred_members: List[ReferredMemberRead]


class ReferralAdminSummary(BaseModel):
    id: str
    referrer_user_id: str
    referrer_name: str
    referrer_phone: str
    referral_code: str
    total_referrals: int
    successful_conversions: int
    is_active: bool
    created_at: datetime

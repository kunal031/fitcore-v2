from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class OwnerDashboardStats(BaseModel):
    total_members: int
    active_subscriptions: int
    expired_subscriptions: int
    checkins_today: int
    revenue_this_month_paise: int
    revenue_last_month_paise: int
    revenue_change_percent: float


class RecentPaymentItem(BaseModel):
    member_name: str
    plan_name: str
    amount_paise: int
    created_at: datetime


class PopularPlanInfo(BaseModel):
    plan_name: str
    active_count: int


class OwnerDashboardResponse(BaseModel):
    stats: OwnerDashboardStats
    expiring_soon_count: int
    recent_payments: List[RecentPaymentItem]
    popular_plan: Optional[PopularPlanInfo] = None


class LastCheckInInfo(BaseModel):
    member_name: str
    time: datetime


class TrainerDashboardResponse(BaseModel):
    checkins_today: int
    expiring_soon_count: int
    last_checkin: Optional[LastCheckInInfo] = None

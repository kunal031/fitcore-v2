from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel


class AttendanceEntryRead(BaseModel):
    date: str
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    marked_by: str


class PlanSnapshotRead(BaseModel):
    plan_name: str
    price_paise: int
    allocated_days: int
    calendar_days: int
    features: List[str]


class SubscriptionRead(BaseModel):
    id: str
    user_id: str
    plan_id: str
    payment_id: str
    plan_snapshot: PlanSnapshotRead
    status: str  # "active" | "paused" | "expired" | "exhausted" | "cancelled"
    allocated_days: int
    days_used: int
    days_remaining: int
    starts_on: date
    expires_on: date
    days_until_expiry: int
    attendance_log: List[AttendanceEntryRead]
    created_at: datetime


class ExpiringSubscriptionItem(BaseModel):
    subscription_id: str
    member_id: str
    member_name: str
    member_phone: str
    plan_name: str
    days_remaining: int
    expires_on: date
    days_until_expiry: int

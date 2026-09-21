from datetime import date, datetime
from typing import List, Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field

from app.utils.date_utils import get_utc_now


class AttendanceEntry(BaseModel):
    date: str  # YYYY-MM-DD
    check_in_time: datetime = Field(default_factory=get_utc_now)
    check_out_time: Optional[datetime] = None
    marked_by: PydanticObjectId


class PlanSnapshot(BaseModel):
    plan_name: str
    price_paise: int
    allocated_days: int
    calendar_days: int
    features: List[str] = Field(default_factory=list)


class SubscriptionDocument(Document):
    user_id: Indexed(PydanticObjectId)
    plan_id: PydanticObjectId
    payment_id: PydanticObjectId

    plan_snapshot: PlanSnapshot
    status: Indexed(str) = "active"  # "active" | "paused" | "expired" | "exhausted" | "cancelled"

    allocated_days: int
    days_used: int = 0
    days_remaining: int

    starts_on: date
    expires_on: Indexed(date)

    attendance_log: List[AttendanceEntry] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    class Settings:
        name = "subscriptions"
        use_state_management = True

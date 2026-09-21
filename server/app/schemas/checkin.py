from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
from app.utils.formatters import format_phone


class CheckInRequest(BaseModel):
    member_id: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return format_phone(v)
        return v


class CheckInMemberSummary(BaseModel):
    id: str
    full_name: str
    phone: str
    avatar_url: Optional[str] = None


class CheckInResult(BaseModel):
    member: CheckInMemberSummary
    check_in_time: datetime
    days_remaining: int
    allocated_days: int
    is_first_today: bool


class TodayCheckInItem(BaseModel):
    member: CheckInMemberSummary
    check_in_time: datetime
    days_remaining: int

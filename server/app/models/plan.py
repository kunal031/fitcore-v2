from datetime import datetime
from typing import List, Optional

from beanie import Document
from pydantic import Field

from app.utils.date_utils import get_utc_now


class PlanDocument(Document):
    plan_name: str
    description: Optional[str] = None
    category: str = "standard"  # "basic" | "standard" | "premium"
    price_paise: int  # Amount in paise e.g. 150000 = ₹1500
    calendar_days: int  # Validity window in calendar days (e.g. 30)
    allocated_days: int  # Number of gym visits allowed (e.g. 26)
    features: List[str] = Field(default_factory=list)

    is_active: bool = True
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    class Settings:
        name = "fitness_plans"
        use_state_management = True

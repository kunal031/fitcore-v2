from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class PlanCreate(BaseModel):
    plan_name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    category: str = "standard"  # "basic" | "standard" | "premium"
    price_paise: int = Field(..., gt=0, description="Price in paise e.g. 150000 = ₹1,500.00")
    calendar_days: int = Field(..., gt=0, description="Validity duration in days")
    allocated_days: int = Field(..., gt=0, description="Number of gym visits permitted")
    features: List[str] = Field(default_factory=list)


class PlanUpdate(BaseModel):
    plan_name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = None
    price_paise: Optional[int] = Field(None, gt=0)
    calendar_days: Optional[int] = Field(None, gt=0)
    allocated_days: Optional[int] = Field(None, gt=0)
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None


class PlanRead(BaseModel):
    id: str
    plan_name: str
    description: Optional[str] = None
    category: str
    price_paise: int
    calendar_days: int
    allocated_days: int
    features: List[str]
    is_active: bool
    created_at: datetime

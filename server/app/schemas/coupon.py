from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CouponCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    discount_type: str = "percentage"  # "percentage" | "flat_paise"
    discount_value: int = Field(..., gt=0)
    min_plan_price_paise: int = 0
    max_discount_paise: Optional[int] = None
    max_uses: int = 100
    per_user_limit: int = 1
    applicable_to: List[str] = Field(default_factory=lambda: ["all"])
    valid_from: Optional[datetime] = None
    valid_until: datetime


class CouponUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_uses: Optional[int] = None
    per_user_limit: Optional[int] = None
    valid_until: Optional[datetime] = None
    is_active: Optional[bool] = None


class CouponRead(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    discount_type: str
    discount_value: int
    min_plan_price_paise: int
    max_discount_paise: Optional[int] = None
    max_uses: int
    current_uses: int
    per_user_limit: int
    applicable_to: List[str]
    valid_from: datetime
    valid_until: datetime
    is_active: bool
    created_at: datetime


class CouponValidationResponse(BaseModel):
    valid: bool
    code: str
    discount_type: Optional[str] = None
    discount_value: Optional[int] = None
    discount_paise: int = 0
    original_paise: int = 0
    final_paise: int = 0
    description: Optional[str] = None
    reason: Optional[str] = None

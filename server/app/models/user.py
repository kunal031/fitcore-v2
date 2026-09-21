from datetime import date, datetime
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field

from app.utils.date_utils import get_utc_now


class AddressSubdocument(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class UserProfileSubdocument(BaseModel):
    dob: Optional[date] = None
    blood_group: Optional[str] = None
    gender: Optional[str] = None
    avatar_url: Optional[str] = None
    address: AddressSubdocument = Field(default_factory=AddressSubdocument)


class GymMetaSubdocument(BaseModel):
    joined_on: date = Field(default_factory=lambda: get_utc_now().date())
    membership_status: str = "inactive"  # "active" | "inactive" | "expired" | "suspended"
    assigned_trainer_id: Optional[PydanticObjectId] = None


class UserDocument(Document):
    phone: Indexed(str, unique=True)
    hashed_password: str
    role: str = "member"  # "owner" | "trainer" | "member"
    full_name: str
    email: Optional[str] = None

    profile: UserProfileSubdocument = Field(default_factory=UserProfileSubdocument)
    gym_meta: GymMetaSubdocument = Field(default_factory=GymMetaSubdocument)

    active_subscription_id: Optional[PydanticObjectId] = None
    my_referral_code: Indexed(str, unique=True)
    referred_by_code: Optional[str] = None
    loyalty_points: int = 0
    token_version: int = 0

    is_active: bool = True
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    class Settings:
        name = "users"
        use_state_management = True

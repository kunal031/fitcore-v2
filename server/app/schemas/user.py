from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.utils.formatters import format_phone, is_valid_indian_phone


class UserAddressUpdate(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    dob: Optional[date] = None
    blood_group: Optional[str] = None
    gender: Optional[str] = None
    avatar_url: Optional[str] = None
    address: Optional[UserAddressUpdate] = None


class UserCreateManual(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str
    password: str = Field(..., min_length=6)
    role: str = "member"  # "member" | "trainer"
    email: Optional[EmailStr] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not is_valid_indian_phone(v):
            raise ValueError("Must be a valid 10-digit Indian phone number")
        return format_phone(v)


class UserStatusUpdate(BaseModel):
    is_active: Optional[bool] = None
    membership_status: Optional[str] = None  # "active" | "inactive" | "expired" | "suspended"


class AssignTrainerRequest(BaseModel):
    trainer_id: str


class AddressRead(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class ProfileRead(BaseModel):
    dob: Optional[date] = None
    blood_group: Optional[str] = None
    gender: Optional[str] = None
    avatar_url: Optional[str] = None
    address: AddressRead = Field(default_factory=AddressRead)


class GymMetaRead(BaseModel):
    joined_on: date
    membership_status: str
    assigned_trainer_id: Optional[str] = None
    assigned_trainer_name: Optional[str] = None


class UserRead(BaseModel):
    id: str
    full_name: str
    phone: str
    email: Optional[str] = None
    role: str
    profile: ProfileRead
    gym_meta: GymMetaRead
    active_subscription_id: Optional[str] = None
    my_referral_code: str
    loyalty_points: int
    is_active: bool

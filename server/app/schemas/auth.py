from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.utils.formatters import is_valid_indian_phone, format_phone, is_valid_email, format_email


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    referral_code: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not is_valid_indian_phone(v):
            raise ValueError("Must be a valid 10-digit Indian phone number")
        return format_phone(v)
    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        # Ensures "User@Gmail.Com" is stored as "user@gmail.com"
        return str(v).strip().lower()

class LoginRequest(BaseModel):
    identifier: str = Field(
        ...,
        description="Indian phone number (+91... or 10 digits) OR Email address",
        examples=["+919999999999", "owner@fitcore.in"],
    )
    password: str = Field(..., min_length=1, description="Account password")

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        cleaned = v.strip()
        if "@" in cleaned:
            if not is_valid_email(cleaned):
                raise ValueError("Please provide a valid email address.")
            return format_email(cleaned)
        
        # If it's a phone number, validate Indian format and add +91
        if not is_valid_indian_phone(cleaned):
            raise ValueError("Must be a valid 10-digit Indian phone number or a valid email address.")
        return format_phone(cleaned)

class UserBasicInfo(BaseModel):
    id: str
    full_name: str
    phone: str
    role: str
    membership_status: str


class TokenResponse(BaseModel):
    user: UserBasicInfo
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class SendOTPRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not is_valid_indian_phone(v):
            raise ValueError("Must be a valid 10-digit Indian phone number")
        return format_phone(v)


class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str = Field(..., min_length=4, max_length=6)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return format_phone(v)


class ResetPasswordRequest(BaseModel):
    phone: str
    reset_token: str
    new_password: str = Field(..., min_length=6, max_length=100)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return format_phone(v)


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=100)

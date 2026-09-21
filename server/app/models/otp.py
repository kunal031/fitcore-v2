from datetime import datetime

from beanie import Document, Indexed
from pydantic import Field

from app.utils.date_utils import get_utc_now


class PasswordResetOTP(Document):
    phone: Indexed(str)
    otp_hash: str
    expires_at: datetime
    attempts: int = 0
    consumed: bool = False
    created_at: datetime = Field(default_factory=get_utc_now)

    class Settings:
        name = "password_reset_otps"

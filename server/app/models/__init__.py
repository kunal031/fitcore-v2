from app.models.coupon import CouponDocument
from app.models.otp import PasswordResetOTP
from app.models.payment import PaymentDocument
from app.models.plan import PlanDocument
from app.models.referral import ReferralDocument
from app.models.subscription import SubscriptionDocument
from app.models.user import UserDocument

ALL_DOCUMENT_MODELS = [
    UserDocument,
    PlanDocument,
    SubscriptionDocument,
    PaymentDocument,
    CouponDocument,
    ReferralDocument,
    PasswordResetOTP,
]

__all__ = [
    "UserDocument",
    "PlanDocument",
    "SubscriptionDocument",
    "PaymentDocument",
    "CouponDocument",
    "ReferralDocument",
    "PasswordResetOTP",
    "ALL_DOCUMENT_MODELS",
]

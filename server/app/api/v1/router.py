from fastapi import APIRouter

from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.checkin import router as checkin_router
from app.api.v1.routes.coupons import router as coupons_router
from app.api.v1.routes.dashboard import router as dashboard_router
from app.api.v1.routes.payments import router as payments_router
from app.api.v1.routes.plans import router as plans_router
from app.api.v1.routes.referrals import router as referrals_router
from app.api.v1.routes.subscriptions import router as subscriptions_router
from app.api.v1.routes.users import router as users_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["Auth"])
router.include_router(users_router, prefix="/users", tags=["Users"])
router.include_router(plans_router, prefix="/plans", tags=["Plans"])
router.include_router(subscriptions_router, prefix="/subscriptions", tags=["Subscriptions"])
router.include_router(checkin_router, prefix="/checkin", tags=["Check-In"])
router.include_router(payments_router, prefix="/payments", tags=["Payments"])
router.include_router(coupons_router, prefix="/coupons", tags=["Coupons"])
router.include_router(referrals_router, prefix="/referrals", tags=["Referrals"])
router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])

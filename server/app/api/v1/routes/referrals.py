from typing import List
from fastapi import APIRouter, Depends

from app.middleware.auth import get_current_user, require_member, require_owner
from app.models.user import UserDocument
from app.schemas.common import APIResponse
from app.schemas.referral import ReferralAdminSummary, ReferralRead
from app.services.referral_service import referral_service

router = APIRouter()


@router.get("/me", response_model=APIResponse[ReferralRead])
async def get_my_referral_info(current_user: UserDocument = Depends(require_member)):
    data = await referral_service.get_my_referral(current_user)
    return APIResponse(data=data)


@router.get("", response_model=APIResponse[List[ReferralAdminSummary]])
async def list_all_referrals(current_user: UserDocument = Depends(require_owner)):
    data = await referral_service.list_all_admin()
    return APIResponse(data=data)

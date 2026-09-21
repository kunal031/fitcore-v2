from typing import List
from fastapi import APIRouter, Depends

from app.middleware.auth import require_trainer_or_owner
from app.models.user import UserDocument
from app.schemas.checkin import CheckInRequest, CheckInResult, TodayCheckInItem
from app.schemas.common import APIResponse
from app.services.checkin_service import checkin_service

router = APIRouter()


@router.post("", response_model=APIResponse[CheckInResult])
async def mark_checkin(
    payload: CheckInRequest,
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await checkin_service.mark_attendance(payload, marked_by_id=current_user.id)
    msg = (
        f"✅ Welcome, {data.member.full_name}! {data.days_remaining} days remaining."
        if data.is_first_today
        else f"✅ Welcome back, {data.member.full_name}! (Re-entry today)"
    )
    return APIResponse(data=data, message=msg)


@router.get("/today", response_model=APIResponse[List[TodayCheckInItem]])
async def get_today_checkins(
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await checkin_service.get_today_checkins()
    return APIResponse(data=data)


@router.get("/history", response_model=APIResponse[list])
async def get_member_attendance_history(
    member_id: str,
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await checkin_service.get_member_attendance(member_id)
    return APIResponse(data=data)

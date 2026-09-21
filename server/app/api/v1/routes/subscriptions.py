from typing import List
from fastapi import APIRouter, Depends, Query

from app.middleware.auth import (
    get_current_user,
    require_member,
    require_owner,
    require_trainer_or_owner,
)
from app.models.user import UserDocument
from app.schemas.common import APIResponse
from app.schemas.subscription import ExpiringSubscriptionItem, SubscriptionRead
from app.services.subscription_service import subscription_service

router = APIRouter()


@router.get("/me", response_model=APIResponse[SubscriptionRead])
async def get_my_active_subscription(
    current_user: UserDocument = Depends(require_member),
):
    data = await subscription_service.get_active_subscription(str(current_user.id))
    if not data:
        return APIResponse(success=False, data=None, message="No active subscription found.")
    return APIResponse(data=data)


@router.get("/me/history", response_model=APIResponse[List[SubscriptionRead]])
async def get_my_subscription_history(
    current_user: UserDocument = Depends(require_member),
):
    data = await subscription_service.get_history(str(current_user.id))
    return APIResponse(data=data)


@router.get("/expiring", response_model=APIResponse[List[ExpiringSubscriptionItem]])
async def get_expiring_subscriptions(
    days: int = Query(7, ge=1, le=30),
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await subscription_service.get_expiring(days=days)
    return APIResponse(data=data)


@router.get("/{sub_id}", response_model=APIResponse[SubscriptionRead])
async def get_subscription_by_id(
    sub_id: str,
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await subscription_service.get_by_id(sub_id)
    return APIResponse(data=data)


@router.post("/{sub_id}/pause", response_model=APIResponse[SubscriptionRead])
async def pause_subscription(
    sub_id: str,
    current_user: UserDocument = Depends(require_owner),
):
    data = await subscription_service.pause(sub_id)
    return APIResponse(data=data, message="Subscription paused.")


@router.post("/{sub_id}/resume", response_model=APIResponse[SubscriptionRead])
async def resume_subscription(
    sub_id: str,
    current_user: UserDocument = Depends(require_owner),
):
    data = await subscription_service.resume(sub_id)
    return APIResponse(data=data, message="Subscription resumed.")


@router.post("/{sub_id}/cancel", response_model=APIResponse[SubscriptionRead])
async def cancel_subscription(
    sub_id: str,
    current_user: UserDocument = Depends(require_owner),
):
    data = await subscription_service.cancel(sub_id)
    return APIResponse(data=data, message="Subscription cancelled.")

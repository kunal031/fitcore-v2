from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status

from app.middleware.auth import (
    get_current_user,
    require_owner,
    require_trainer_or_owner,
)
from app.models.user import UserDocument
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.user import (
    AssignTrainerRequest,
    UserCreateManual,
    UserProfileUpdate,
    UserRead,
    UserStatusUpdate,
)
from app.services.user_service import user_service

router = APIRouter()


@router.get("/me", response_model=APIResponse[UserRead])
async def get_my_profile(current_user: UserDocument = Depends(get_current_user)):
    data = await user_service.to_user_read_with_trainer(current_user)
    return APIResponse(data=data)


@router.patch("/me", response_model=APIResponse[UserRead])
async def update_my_profile(
    payload: UserProfileUpdate,
    current_user: UserDocument = Depends(get_current_user),
):
    data = await user_service.update_profile(str(current_user.id), payload)
    return APIResponse(data=data, message="Profile updated successfully.")


@router.get("", response_model=PaginatedResponse[UserRead])
async def list_members(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await user_service.list_users(
        page=page,
        limit=limit,
        search=search,
        role=role,
        membership_status=status,
    )
    return PaginatedResponse(data=data)


@router.post("", response_model=APIResponse[UserRead], status_code=status.HTTP_201_CREATED)
async def create_member_manual(
    payload: UserCreateManual,
    current_user: UserDocument = Depends(require_owner),
):
    data = await user_service.create_user_manual(payload)
    return APIResponse(data=data, message="User created successfully.")


@router.get("/trainers", response_model=APIResponse[List[UserRead]])
async def list_trainers(current_user: UserDocument = Depends(require_owner)):
    data = await user_service.list_trainers()
    return APIResponse(data=data)


@router.get("/{user_id}", response_model=APIResponse[UserRead])
async def get_user_by_id(
    user_id: str,
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await user_service.get_by_id(user_id)
    return APIResponse(data=data)


@router.patch("/{user_id}/status", response_model=APIResponse[UserRead])
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    current_user: UserDocument = Depends(require_owner),
):
    data = await user_service.update_status(user_id, payload)
    return APIResponse(data=data, message="User status updated successfully.")


@router.post("/{user_id}/assign-trainer", response_model=APIResponse[UserRead])
async def assign_trainer(
    user_id: str,
    payload: AssignTrainerRequest,
    current_user: UserDocument = Depends(require_owner),
):
    data = await user_service.assign_trainer(user_id, payload.trainer_id)
    return APIResponse(data=data, message="Trainer assigned successfully.")


@router.get("/{user_id}/qr", response_model=APIResponse[dict])
async def get_member_qr(
    user_id: str,
    current_user: UserDocument = Depends(get_current_user),
):
    # Member can access own QR; Trainer/Owner can access anyone's
    if current_user.role == "member" and str(current_user.id) != user_id:
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Access denied.")

    return APIResponse(
        data={
            "member_id": user_id,
            "qr_data": f"fitcore:member:{user_id}",
        }
    )

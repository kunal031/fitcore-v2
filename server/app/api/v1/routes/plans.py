from typing import List
from fastapi import APIRouter, Depends, status

from app.middleware.auth import get_current_user, require_owner
from app.models.user import UserDocument
from app.schemas.common import APIResponse
from app.schemas.plan import PlanCreate, PlanRead, PlanUpdate
from app.services.plan_service import plan_service

router = APIRouter()


@router.get("", response_model=APIResponse[List[PlanRead]])
async def list_active_plans(current_user: UserDocument = Depends(get_current_user)):
    data = await plan_service.list_active()
    return APIResponse(data=data)


@router.get("/all", response_model=APIResponse[List[PlanRead]])
async def list_all_plans(current_user: UserDocument = Depends(require_owner)):
    data = await plan_service.list_all()
    return APIResponse(data=data)


@router.post("", response_model=APIResponse[PlanRead], status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    current_user: UserDocument = Depends(require_owner),
):
    data = await plan_service.create(payload)
    return APIResponse(data=data, message=f"Plan '{payload.plan_name}' created successfully.")


@router.get("/{plan_id}", response_model=APIResponse[PlanRead])
async def get_plan(plan_id: str, current_user: UserDocument = Depends(get_current_user)):
    data = await plan_service.get_by_id(plan_id)
    return APIResponse(data=data)


@router.patch("/{plan_id}", response_model=APIResponse[PlanRead])
async def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    current_user: UserDocument = Depends(require_owner),
):
    data = await plan_service.update(plan_id, payload)
    return APIResponse(data=data, message="Plan updated successfully.")


@router.patch("/{plan_id}/deactivate", response_model=APIResponse[PlanRead])
async def deactivate_plan(
    plan_id: str,
    current_user: UserDocument = Depends(require_owner),
):
    data = await plan_service.set_active(plan_id, is_active=False)
    return APIResponse(data=data, message="Plan deactivated.")


@router.patch("/{plan_id}/activate", response_model=APIResponse[PlanRead])
async def activate_plan(
    plan_id: str,
    current_user: UserDocument = Depends(require_owner),
):
    data = await plan_service.set_active(plan_id, is_active=True)
    return APIResponse(data=data, message="Plan activated.")

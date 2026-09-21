from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.middleware.auth import get_current_user, require_owner
from app.models.user import UserDocument
from app.schemas.common import APIResponse
from app.schemas.coupon import (
    CouponCreate,
    CouponRead,
    CouponUpdate,
    CouponValidationResponse,
)
from app.services.coupon_service import coupon_service

router = APIRouter()


@router.get("", response_model=APIResponse[List[CouponRead]])
async def list_coupons(current_user: UserDocument = Depends(require_owner)):
    data = await coupon_service.list_all()
    return APIResponse(data=data)


@router.post("", response_model=APIResponse[CouponRead], status_code=status.HTTP_201_CREATED)
async def create_coupon(
    payload: CouponCreate,
    current_user: UserDocument = Depends(require_owner),
):
    data = await coupon_service.create(payload)
    return APIResponse(data=data, message=f"Coupon '{payload.code}' created successfully.")


@router.get("/validate/{code}", response_model=APIResponse[CouponValidationResponse])
async def validate_coupon(
    code: str,
    plan_id: str = Query(...),
    current_user: UserDocument = Depends(get_current_user),
):
    data = await coupon_service.validate_coupon(
        code=code,
        plan_id=plan_id,
        user_id=str(current_user.id),
    )
    return APIResponse(data=data)


@router.get("/{coupon_id}", response_model=APIResponse[CouponRead])
async def get_coupon(
    coupon_id: str,
    current_user: UserDocument = Depends(require_owner),
):
    data = await coupon_service.get_by_id(coupon_id)
    return APIResponse(data=data)


@router.patch("/{coupon_id}", response_model=APIResponse[CouponRead])
async def update_coupon(
    coupon_id: str,
    payload: CouponUpdate,
    current_user: UserDocument = Depends(require_owner),
):
    data = await coupon_service.update(coupon_id, payload)
    return APIResponse(data=data, message="Coupon updated.")


@router.patch("/{coupon_id}/deactivate", response_model=APIResponse[CouponRead])
async def deactivate_coupon(
    coupon_id: str,
    current_user: UserDocument = Depends(require_owner),
):
    data = await coupon_service.update(coupon_id, CouponUpdate(is_active=False))
    return APIResponse(data=data, message="Coupon deactivated.")

from typing import List
from fastapi import APIRouter, Depends, status

from app.middleware.auth import (
    get_current_user,
    require_member,
    require_owner,
    require_trainer_or_owner,
)
from app.models.user import UserDocument
from app.schemas.common import APIResponse
from app.schemas.payment import (
    InitiatePaymentRequest,
    InitiatePaymentResponse,
    ManualPaymentRequest,
    PaymentRead,
    VerifyPaymentRequest,
)
from app.services.payment_service import payment_service

router = APIRouter()


@router.post("/initiate", response_model=APIResponse[InitiatePaymentResponse])
async def initiate_payment(
    payload: InitiatePaymentRequest,
    current_user: UserDocument = Depends(require_member),
):
    data = await payment_service.initiate_checkout(current_user, payload)
    return APIResponse(data=data, message="Payment initiated.")


@router.post("/verify", response_model=APIResponse[PaymentRead])
async def verify_payment(
    payload: VerifyPaymentRequest,
    current_user: UserDocument = Depends(require_member),
):
    data = await payment_service.verify_payment(current_user, payload)
    return APIResponse(data=data, message="Payment verified and subscription activated successfully!")


@router.post("/manual", response_model=APIResponse[PaymentRead], status_code=status.HTTP_201_CREATED)
async def record_manual_payment(
    payload: ManualPaymentRequest,
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await payment_service.record_manual_payment(current_user, payload)
    return APIResponse(data=data, message="Manual payment recorded and plan activated.")


@router.get("/me", response_model=APIResponse[List[PaymentRead]])
async def get_my_payments(current_user: UserDocument = Depends(require_member)):
    data = await payment_service.get_my_payments(str(current_user.id))
    return APIResponse(data=data)


@router.get("", response_model=APIResponse[List[PaymentRead]])
async def list_all_payments(current_user: UserDocument = Depends(require_owner)):
    data = await payment_service.list_all_payments()
    return APIResponse(data=data)

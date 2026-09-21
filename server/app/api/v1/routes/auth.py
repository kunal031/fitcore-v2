import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, status
from loguru import logger

from app.core.security import create_password_reset_token, hash_password, verify_password
from app.middleware.auth import get_current_user
from app.models.otp import PasswordResetOTP
from app.models.user import UserDocument
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SendOTPRequest,
    TokenResponse,
    VerifyOTPRequest,
)
from app.schemas.common import APIResponse
from app.services.auth_service import auth_service
from app.utils.date_utils import get_utc_now

router = APIRouter()


@router.post(
    "/register",
    response_model=APIResponse[TokenResponse],
    status_code=status.HTTP_201_CREATED,
)
async def register(payload: RegisterRequest):
    data = await auth_service.register(payload)
    return APIResponse(data=data, message=f"Welcome to FitCore, {payload.full_name}!")


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(payload: LoginRequest):
    data = await auth_service.login(payload)
    return APIResponse(data=data, message="Login successful.")


@router.post("/refresh", response_model=APIResponse[TokenResponse])
async def refresh_token(payload: RefreshTokenRequest):
    data = await auth_service.refresh_token(payload.refresh_token)
    return APIResponse(data=data, message="Token refreshed successfully.")


@router.post("/logout", response_model=APIResponse[dict])
async def logout(current_user: UserDocument = Depends(get_current_user)):
    await auth_service.logout(current_user)
    return APIResponse(data={"logged_out": True}, message="Successfully logged out.")


@router.patch("/change-password", response_model=APIResponse[dict])
async def change_password(
    payload: ChangePasswordRequest,
    current_user: UserDocument = Depends(get_current_user),
):
    await auth_service.change_password(current_user, payload)
    return APIResponse(data={"updated": True}, message="Password changed successfully.")


@router.post("/send-otp", response_model=APIResponse[dict])
async def send_otp(payload: SendOTPRequest):
    otp = f"{secrets.randbelow(1_000_000):06d}"
    record = PasswordResetOTP(
        phone=payload.phone,
        otp_hash=hash_password(otp),
        expires_at=get_utc_now() + timedelta(minutes=5),
    )
    await record.insert()
    logger.info("Password reset OTP generated for {}: {}", payload.phone, otp)
    return APIResponse(
        data={"sent": True},
        message="OTP sent to registered phone number.",
    )


@router.post("/verify-otp", response_model=APIResponse[dict])
async def verify_otp(payload: VerifyOTPRequest):
    records = await PasswordResetOTP.find(
        {"phone": payload.phone, "consumed": False},
    ).sort("-created_at").limit(1).to_list()
    record = records[0] if records else None
    if not record or record.expires_at <= get_utc_now():
        return APIResponse(data=None, message="The OTP is invalid or expired.")
    if record.attempts >= 5:
        return APIResponse(data=None, message="Too many invalid OTP attempts.")
    if not verify_password(payload.otp, record.otp_hash):
        record.attempts += 1
        await record.save()
        return APIResponse(data=None, message="The OTP is invalid or expired.")

    record.consumed = True
    await record.save()
    return APIResponse(
        data={"verified": True, "reset_token": create_password_reset_token(payload.phone)},
        message="OTP verified successfully.",
    )


@router.post("/reset-password", response_model=APIResponse[dict])
async def reset_password(payload: ResetPasswordRequest):
    await auth_service.reset_password(payload)
    return APIResponse(
        data={"reset": True},
        message="Password has been reset successfully. Please log in.",
    )

from typing import Optional

from beanie import PydanticObjectId
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AuthException, ForbiddenException
from app.core.security import decode_token
from app.models.user import UserDocument

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> UserDocument:
    """
    Extracts Bearer token from header, validates JWT, fetches UserDocument.
    Raises 401 AuthException if invalid or user not found.
    """
    if not credentials or not credentials.credentials:
        raise AuthException(
            message="Authentication credentials were not provided.",
            error_code="CREDENTIALS_MISSING",
        )

    token = credentials.credentials
    payload = decode_token(token, expected_type="access")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthException(
            message="Malformed authentication token.",
            error_code="INVALID_TOKEN",
        )

    try:
        user = await UserDocument.get(PydanticObjectId(user_id))
    except Exception:
        raise AuthException(
            message="User associated with token not found.",
            error_code="USER_NOT_FOUND",
        )

    if not user:
        raise AuthException(
            message="User associated with token no longer exists.",
            error_code="USER_NOT_FOUND",
        )

    if not user.is_active:
        raise ForbiddenException(
            message="Your account is deactivated. Contact gym management.",
            error_code="ACCOUNT_DEACTIVATED",
        )

    if payload.get("ver", 0) != user.token_version:
        raise AuthException(
            message="This access token is no longer valid. Please log in again.",
            error_code="TOKEN_REVOKED",
        )

    return user


async def require_owner(
    current_user: UserDocument = Depends(get_current_user),
) -> UserDocument:
    """Ensures caller has 'owner' role."""
    if current_user.role != "owner":
        raise ForbiddenException(
            message="Access denied: Owner privileges required.",
            error_code="OWNER_ROLE_REQUIRED",
        )
    return current_user


async def require_trainer_or_owner(
    current_user: UserDocument = Depends(get_current_user),
) -> UserDocument:
    """Ensures caller has either 'trainer' or 'owner' role."""
    if current_user.role not in ["owner", "trainer"]:
        raise ForbiddenException(
            message="Access denied: Trainer or Owner privileges required.",
            error_code="STAFF_ROLE_REQUIRED",
        )
    return current_user


async def require_member(
    current_user: UserDocument = Depends(get_current_user),
) -> UserDocument:
    """Ensures caller has 'member' role."""
    if current_user.role != "member":
        raise ForbiddenException(
            message="Access denied: Member privileges required.",
            error_code="MEMBER_ROLE_REQUIRED",
        )
    return current_user

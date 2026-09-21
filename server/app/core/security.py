from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import AuthException

# ── Password Hashing ─────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Constant-time comparison of plain password vs stored hash.
    Prevents timing attacks.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT Token Creation ────────────────────────────────────────────────────────
def create_access_token(user_id: str, role: str, token_version: int = 0) -> str:
    """
    Create a short-lived JWT access token.
    Expires in ACCESS_TOKEN_EXPIRE_MINUTES (default: 15 min).
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": user_id,
        "role": role,
        "ver": token_version,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    """
    Create a long-lived JWT refresh token.
    Expires in REFRESH_TOKEN_EXPIRE_DAYS (default: 30 days).
    Contains NO role — only user identity.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": user_id,
        "type": "refresh",
        "ver": token_version,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_password_reset_token(phone: str) -> str:
    """Create a short-lived token bound to the phone used for password recovery."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {
        "sub": phone,
        "type": "password_reset",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── JWT Token Decoding ────────────────────────────────────────────────────────
def decode_token(token: str, expected_type: str = "access") -> dict:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT string to decode
        expected_type: "access" or "refresh"

    Returns:
        Decoded payload dict

    Raises:
        AuthException: If token is expired, invalid, or wrong type
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise AuthException(
            message="Invalid or expired token. Please log in again.",
            error_code="INVALID_TOKEN",
        )

    token_type: Optional[str] = payload.get("type")
    if token_type != expected_type:
        raise AuthException(
            message=f"Expected a {expected_type} token but received a {token_type} token.",
            error_code="WRONG_TOKEN_TYPE",
        )

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise AuthException(
            message="Token is missing user identity.",
            error_code="INVALID_TOKEN",
        )

    return payload

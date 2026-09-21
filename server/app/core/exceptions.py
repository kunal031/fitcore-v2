from typing import Optional


class FitCoreException(Exception):
    """Base exception for all FitCore business errors."""

    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        field: Optional[str] = None,
    ) -> None:
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        self.field = field
        super().__init__(message)


class AuthException(FitCoreException):
    """401 — Invalid or expired credentials / token."""

    def __init__(self, message: str = "Authentication failed", error_code: str = "AUTH_FAILED") -> None:
        super().__init__(status_code=401, error_code=error_code, message=message)


class ForbiddenException(FitCoreException):
    """403 — Authenticated but insufficient permissions."""

    def __init__(self, message: str = "You don't have permission to perform this action", error_code: str = "FORBIDDEN") -> None:
        super().__init__(status_code=403, error_code=error_code, message=message)


class NotFoundException(FitCoreException):
    """404 — Requested resource does not exist."""

    def __init__(self, message: str = "Resource not found", error_code: str = "NOT_FOUND") -> None:
        super().__init__(status_code=404, error_code=error_code, message=message)


class ConflictException(FitCoreException):
    """409 — Resource already exists or conflicting state."""

    def __init__(self, message: str = "Conflict with existing resource", error_code: str = "CONFLICT") -> None:
        super().__init__(status_code=409, error_code=error_code, message=message)


class BusinessException(FitCoreException):
    """422 — Request is valid but violates a business rule."""

    def __init__(self, message: str, error_code: str = "BUSINESS_RULE_VIOLATION", field: Optional[str] = None) -> None:
        super().__init__(status_code=422, error_code=error_code, message=message, field=field)


ValidationException = BusinessException


class PaymentException(FitCoreException):
    """402 — Payment processing failed."""

    def __init__(self, message: str, error_code: str = "PAYMENT_FAILED") -> None:
        super().__init__(status_code=402, error_code=error_code, message=message)


class RateLimitException(FitCoreException):
    """429 — Too many requests."""

    def __init__(self, message: str = "Too many requests. Please slow down.", error_code: str = "RATE_LIMITED") -> None:
        super().__init__(status_code=429, error_code=error_code, message=message)

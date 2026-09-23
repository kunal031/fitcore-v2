/**
 * Concrete error types, one per HTTP status the API uses.
 *
 * Default messages and error codes are stable so the
 * frontend's error handling keeps working without changes.
 */
import { AppError } from "./AppError.js";

/** 401 — invalid or expired credentials / token. */
export class AuthError extends AppError {
  constructor(message = "Authentication failed", errorCode = "AUTH_FAILED") {
    super(401, errorCode, message);
  }
}

/** 403 — authenticated but lacking permission. */
export class ForbiddenError extends AppError {
  constructor(
    message = "You don't have permission to perform this action",
    errorCode = "FORBIDDEN",
  ) {
    super(403, errorCode, message);
  }
}

/** 404 — the requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found", errorCode = "NOT_FOUND") {
    super(404, errorCode, message);
  }
}

/** 409 — resource already exists, or the request conflicts with current state. */
export class ConflictError extends AppError {
  constructor(
    message = "Conflict with existing resource",
    errorCode = "CONFLICT",
  ) {
    super(409, errorCode, message);
  }
}

/**
 * 422 — the request is well-formed but violates a business rule.
 *
 * `ValidationException` is aliased to this same class, so both
 * names are exported here for readability at the call sites.
 */
export class BusinessError extends AppError {
  constructor(
    message: string,
    errorCode = "BUSINESS_RULE_VIOLATION",
    field?: string,
  ) {
    super(422, errorCode, message, field);
  }
}
export { BusinessError as ValidationError };

/** 402 — payment processing failed. */
export class PaymentError extends AppError {
  constructor(message: string, errorCode = "PAYMENT_FAILED") {
    super(402, errorCode, message);
  }
}

/** 429 — too many requests. */
export class RateLimitError extends AppError {
  constructor(
    message = "Too many requests. Please slow down.",
    errorCode = "RATE_LIMITED",
  ) {
    super(429, errorCode, message);
  }
}

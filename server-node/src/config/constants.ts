/**
 * Domain constants shared across services.
 *
 * These mirror the string literals used by the Python server. They are kept
 * here (rather than inlined) so a typo cannot silently create an unreachable
 * status branch.
 */

// ── Roles ──────────────────────────────────────────────────────────────────
// The backend role is `owner`; the frontend displays it as "Admin".
export const ROLES = {
  OWNER: "owner",
  TRAINER: "trainer",
  MEMBER: "member",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ALL_ROLES: Role[] = [ROLES.OWNER, ROLES.TRAINER, ROLES.MEMBER];

// ── Membership status (user.gym_meta.membership_status) ────────────────────
export const MEMBERSHIP_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  EXPIRED: "expired",
  SUSPENDED: "suspended",
} as const;
export type MembershipStatus =
  (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

// ── Subscription status ────────────────────────────────────────────────────
export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  EXPIRED: "expired",
  EXHAUSTED: "exhausted",
  CANCELLED: "cancelled",
} as const;
export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

// ── Payment status & methods ───────────────────────────────────────────────
export const PAYMENT_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_METHOD = {
  RAZORPAY: "razorpay",
  CASH: "cash",
  UPI: "upi",
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

// ── Plans & coupons ────────────────────────────────────────────────────────
export const PLAN_CATEGORY = {
  BASIC: "basic",
  STANDARD: "standard",
  PREMIUM: "premium",
} as const;

export const DISCOUNT_TYPE = {
  PERCENTAGE: "percentage",
  FLAT_PAISE: "flat_paise",
} as const;
export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];

/** Sentinel in `coupon.applicable_to` meaning "every plan". */
export const COUPON_APPLICABLE_ALL = "all";

// ── JWT token types ────────────────────────────────────────────────────────
export const TOKEN_TYPE = {
  ACCESS: "access",
  REFRESH: "refresh",
  PASSWORD_RESET: "password_reset",
} as const;
export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

// ── Collection names (must match the Python `Settings.name` values) ────────
export const COLLECTIONS = {
  USERS: "users",
  PLANS: "fitness_plans",
  SUBSCRIPTIONS: "subscriptions",
  PAYMENTS: "payments",
  COUPONS: "coupons",
  REFERRALS: "referrals",
  PASSWORD_RESET_OTPS: "password_reset_otps",
} as const;

// ── Misc ───────────────────────────────────────────────────────────────────
/** Password reset OTP lifetime, and the max attempts before it is refused. */
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
/** Lifetime of the token handed out after a successful OTP verification. */
export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 10;

/** Cron jobs run on India time, matching the Python APScheduler config. */
export const SCHEDULER_TIMEZONE = "Asia/Kolkata";

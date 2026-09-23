/** Barrel export for every Mongoose model and its document types. */
export { User, type IUser, type UserDoc, type UserProfile, type GymMeta, type Address } from "./User.js";
export { Plan, type IPlan, type PlanDoc } from "./Plan.js";
export {
  Subscription,
  type ISubscription,
  type SubscriptionDoc,
  type AttendanceEntry,
  type PlanSnapshot,
} from "./Subscription.js";
export {
  Payment,
  type IPayment,
  type PaymentDoc,
  type PaymentCouponDetails,
  type PaymentReferralDetails,
} from "./Payment.js";
export { Coupon, type ICoupon, type CouponDoc } from "./Coupon.js";
export { Referral, type IReferral, type ReferralDoc, type ReferredMember } from "./Referral.js";
export {
  PasswordResetOtp,
  type IPasswordResetOtp,
  type PasswordResetOtpDoc,
} from "./PasswordResetOtp.js";
export { Setting, type ISetting, type SettingDoc } from "./Setting.js";

/** Barrel export for the service layer. */
export { authService } from "./auth.service.js";
export { otpService, type VerifyOtpResult } from "./otp.service.js";
export { userService } from "./user.service.js";
export { planService } from "./plan.service.js";
export { subscriptionService } from "./subscription.service.js";
export { checkinService } from "./checkin.service.js";
export { paymentService } from "./payment.service.js";
export { couponService, calculateDiscountPaise } from "./coupon.service.js";
export { referralService } from "./referral.service.js";
export { dashboardService } from "./dashboard.service.js";
export { analyticsService } from "./analytics.service.js";
export { razorpayService } from "./razorpay.service.js";
export { settingService } from "./setting.service.js";
export * from "./mappers/index.js";

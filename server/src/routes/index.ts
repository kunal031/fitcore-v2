/**
 * API v1 router.
 *
 * Mounts every domain router under its prefix, mirroring
 * `server/app/api/v1/router.py`. The prefixes here plus `/api/v1` form the
 * full public paths the frontend calls.
 */
import { Router } from "express";

import { authRoutes } from "./auth.routes.js";
import { checkinRoutes } from "./checkin.routes.js";
import { couponRoutes } from "./coupon.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { paymentRoutes } from "./payment.routes.js";
import { planRoutes } from "./plan.routes.js";
import { referralRoutes } from "./referral.routes.js";
import { subscriptionRoutes } from "./subscription.routes.js";
import { settingRoutes } from "./setting.routes.js";
import { userRoutes } from "./user.routes.js";

export const apiV1Router = Router();

apiV1Router.use("/auth", authRoutes);
apiV1Router.use("/users", userRoutes);
apiV1Router.use("/plans", planRoutes);
apiV1Router.use("/subscriptions", subscriptionRoutes);
apiV1Router.use("/checkin", checkinRoutes);
apiV1Router.use("/payments", paymentRoutes);
apiV1Router.use("/coupons", couponRoutes);
apiV1Router.use("/referrals", referralRoutes);
apiV1Router.use("/dashboard", dashboardRoutes);
apiV1Router.use("/settings", settingRoutes);

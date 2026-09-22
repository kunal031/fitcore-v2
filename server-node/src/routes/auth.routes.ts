/**
 * `/api/v1/auth`
 *
 * Every route here is public except logout and change-password, which need a
 * valid access token. Credential endpoints carry the tighter rate limit.
 */
import { Router } from "express";

import { authController } from "../controllers/index.js";
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from "../dtos/auth.dto.js";
import { authLimiter, requireAuth, validate } from "../middleware/index.js";

export const authRoutes = Router();

// ── Public ─────────────────────────────────────────────────────────────────
authRoutes.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  authController.register,
);

authRoutes.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  authController.login,
);

authRoutes.post(
  "/refresh",
  validate({ body: refreshTokenSchema }),
  authController.refresh,
);

// ── Password recovery (public, OTP-gated) ──────────────────────────────────
authRoutes.post(
  "/send-otp",
  authLimiter,
  validate({ body: sendOtpSchema }),
  authController.sendOtp,
);

authRoutes.post(
  "/verify-otp",
  authLimiter,
  validate({ body: verifyOtpSchema }),
  authController.verifyOtp,
);

authRoutes.post(
  "/reset-password",
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

// ── Authenticated ──────────────────────────────────────────────────────────
authRoutes.post("/logout", requireAuth, authController.logout);

authRoutes.patch(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

/**
 * Auth HTTP handlers.
 *
 * Controllers stay thin: validate has already run, the service holds the
 * logic, and the only job here is choosing the status code and message.
 */
import type { Request, Response } from "express";

import type {
  ChangePasswordInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
  ResetPasswordInput,
  SendOtpInput,
  VerifyOtpInput,
} from "../dtos/auth.dto.js";
import { asyncHandler, currentUser } from "../middleware/index.js";
import { authService, otpService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const authController = {
  /** POST /auth/register — 201 with a token pair. */
  register: asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as RegisterInput;
    const data = await authService.register(payload);
    res.status(201).json(success(data, `Welcome to FitCore, ${payload.full_name}!`));
  }),

  /** POST /auth/login */
  login: asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.login(req.body as LoginInput);
    res.json(success(data, "Login successful."));
  }),

  /** POST /auth/refresh */
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refresh_token } = req.body as RefreshTokenInput;
    const data = await authService.refreshToken(refresh_token);
    res.json(success(data, "Token refreshed successfully."));
  }),

  /** POST /auth/logout — retires every token issued to this user. */
  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(currentUser(req));
    res.json(success({ logged_out: true }, "Successfully logged out."));
  }),

  /** PATCH /auth/change-password */
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(
      currentUser(req),
      req.body as ChangePasswordInput,
    );
    res.json(success({ updated: true }, "Password changed successfully."));
  }),

  /**
   * POST /auth/send-otp
   *
   * Always reports success, whether or not the number is registered, so the
   * endpoint cannot be used to discover which numbers have accounts.
   */
  sendOtp: asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body as SendOtpInput;
    await otpService.sendOtp(phone);
    res.json(success({ sent: true }, "OTP sent to registered phone number."));
  }),

  /**
   * POST /auth/verify-otp
   *
   * A failed verification answers HTTP 200 with `data: null` and the reason in
   * `message`. See KNOWN_ISSUES.md.
   */
  verifyOtp: asyncHandler(async (req: Request, res: Response) => {
    const result = await otpService.verifyOtp(req.body as VerifyOtpInput);

    if (!result.verified) {
      res.json(success(null, result.message));
      return;
    }

    res.json(
      success(
        { verified: true, reset_token: result.resetToken },
        result.message,
      ),
    );
  }),

  /** POST /auth/reset-password */
  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body as ResetPasswordInput);
    res.json(
      success(
        { reset: true },
        "Password has been reset successfully. Please log in.",
      ),
    );
  }),
};

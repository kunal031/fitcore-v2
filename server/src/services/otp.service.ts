/**
 * Password-reset OTP issuing and verification.
 *
 * Mirrors the inline OTP logic in `server/app/api/v1/routes/auth.py`.
 *
 * SMS delivery is mocked: the generated code is written to the log rather than
 * sent. Before this reaches production the `logger.info` below must be replaced
 * with a real SMS provider call, or every reset code will sit in the logs.
 */
import { OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS } from "../config/constants.js";
import type { VerifyOtpInput } from "../dtos/auth.dto.js";
import { otpRepository } from "../repositories/index.js";
import { getUtcNow } from "../utils/date.js";
import { generateOtp } from "../utils/generators.js";
import { createPasswordResetToken } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

/**
 * Result of a verification attempt.
 *
 * Failures are reported as data rather than thrown, because the route
 * answers HTTP 200 with `data: null` for a bad OTP. See KNOWN_ISSUES.md.
 */
export type VerifyOtpResult =
  | { verified: true; resetToken: string; message: string }
  | { verified: false; message: string };

export const otpService = {
  /**
   * Issue an OTP for a phone number.
   *
   * Returns nothing about whether the number is registered, so the endpoint
   * cannot be used to discover which numbers have accounts.
   */
  async sendOtp(phone: string): Promise<void> {
    const otp = generateOtp();
    const expiresAt = new Date(
      getUtcNow().getTime() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    await otpRepository.create({
      phone,
      otp_hash: await hashPassword(otp),
      expires_at: expiresAt,
      attempts: 0,
      consumed: false,
    });

    // Mock SMS delivery — development only.
    logger.info(`Password reset OTP generated for ${phone}: ${otp}`);
  },

  /**
   * Verify an OTP and, on success, issue a short-lived password reset token.
   *
   * The same generic message covers a missing, expired and incorrect OTP so a
   * caller cannot tell them apart. Each wrong guess increments `attempts`, and
   * the record is refused once it reaches the cap.
   */
  async verifyOtp(payload: VerifyOtpInput): Promise<VerifyOtpResult> {
    const record = await otpRepository.findLatestUnconsumed(payload.phone);

    if (!record || record.expires_at <= getUtcNow()) {
      return { verified: false, message: "The OTP is invalid or expired." };
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return { verified: false, message: "Too many invalid OTP attempts." };
    }

    if (!(await verifyPassword(payload.otp, record.otp_hash))) {
      record.attempts += 1;
      await record.save();
      return { verified: false, message: "The OTP is invalid or expired." };
    }

    // Single use: consume the record so the same code cannot be replayed.
    record.consumed = true;
    await record.save();

    return {
      verified: true,
      resetToken: createPasswordResetToken(payload.phone),
      message: "OTP verified successfully.",
    };
  },
};

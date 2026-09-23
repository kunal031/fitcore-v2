/**
 * Password-reset OTP issuing and verification.
 *
 * The code is emailed, never logged and never returned. An account with no
 * email on file therefore cannot self-serve a reset — an admin changes the
 * password for them — which is the accepted trade-off for not having an SMS
 * provider.
 *
 * Records still key on phone, because the phone is the account's identity and
 * the reset token's subject. Email is only how the code travels.
 */
import { OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS } from "../config/constants.js";
import type { VerifyOtpInput } from "../dtos/auth.dto.js";
import { otpRepository, userRepository } from "../repositories/index.js";
import { getUtcNow } from "../utils/date.js";
import { generateOtp } from "../utils/generators.js";
import { createPasswordResetToken } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { emailService } from "./email.service.js";
import { buildPasswordResetEmail } from "./templates/passwordResetEmail.js";

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
   * Email a reset code to whoever owns this address.
   *
   * Returns nothing in every case — unknown address, known address, failed
   * send — so the endpoint cannot be used to discover which emails have
   * accounts. Problems are logged for the operator instead.
   *
   * No OTP record is written unless there is an account to reset, so an
   * unknown address costs one lookup rather than a row and a hash.
   */
  async sendOtpToEmail(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      logger.info("Password reset requested for an address with no account.");
      return;
    }

    const otp = generateOtp();
    const expiresAt = new Date(
      getUtcNow().getTime() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    await otpRepository.create({
      phone: user.phone,
      otp_hash: await hashPassword(otp),
      expires_at: expiresAt,
      attempts: 0,
      consumed: false,
    });

    const message = buildPasswordResetEmail(user.full_name, otp);
    const sent = await emailService.send({
      to: user.email ?? email,
      toName: user.full_name,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (!sent) {
      // The caller is told nothing, so this line is the only trace that a
      // user asked for a reset and did not get one.
      logger.error(
        { userId: String(user._id) },
        "Password reset code could not be delivered.",
      );
    }
  },

  /**
   * Verify an OTP and, on success, issue a short-lived password reset token.
   *
   * The same generic message covers a missing, expired and incorrect OTP so a
   * caller cannot tell them apart. Each wrong guess increments `attempts`, and
   * the record is refused once it reaches the cap.
   */
  async verifyOtp(payload: VerifyOtpInput): Promise<VerifyOtpResult> {
    // An unknown address reads exactly like a wrong code, so verification
    // cannot be used to discover which emails have accounts either.
    const user = await userRepository.findByEmail(payload.email);
    if (!user) {
      return { verified: false, message: "The OTP is invalid or expired." };
    }

    const record = await otpRepository.findLatestUnconsumed(user.phone);

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
      // Subject stays the phone: it is the account's identity, and
      // resetPassword resolves the same way.
      resetToken: createPasswordResetToken(user.phone),
      message: "OTP verified successfully.",
    };
  },
};

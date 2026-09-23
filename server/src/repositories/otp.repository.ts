/**
 * Password-reset OTP queries.
 */
import {
  PasswordResetOtp,
  type IPasswordResetOtp,
  type PasswordResetOtpDoc,
} from "../models/PasswordResetOtp.js";

export const otpRepository = {
  create(data: Partial<IPasswordResetOtp>): Promise<PasswordResetOtpDoc> {
    return PasswordResetOtp.create(data);
  },

  /** The newest unconsumed OTP for a phone number — the only one verifiable. */
  findLatestUnconsumed(phone: string): Promise<PasswordResetOtpDoc | null> {
    return PasswordResetOtp.findOne({ phone, consumed: false })
      .sort({ created_at: -1 })
      .exec();
  },
};

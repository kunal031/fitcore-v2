/**
 * Password-reset OTP.
 *
 * The OTP is stored hashed, never in plain text. In development the generated
 * code is written to the log instead of being sent by SMS.
 */
import { Schema, model, type HydratedDocument } from "mongoose";

import { COLLECTIONS } from "../config/constants.js";

export interface IPasswordResetOtp {
  phone: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  consumed: boolean;
  created_at: Date;
}

export type PasswordResetOtpDoc = HydratedDocument<IPasswordResetOtp>;

const otpSchema = new Schema<IPasswordResetOtp>(
  {
    phone: { type: String, required: true, index: true },
    otp_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
  },
  {
    collection: COLLECTIONS.PASSWORD_RESET_OTPS,
    timestamps: { createdAt: "created_at", updatedAt: false },
    versionKey: false,
  },
);

// Verification reads the newest unconsumed OTP for a phone number.
otpSchema.index({ phone: 1, consumed: 1, created_at: -1 });

export const PasswordResetOtp = model<IPasswordResetOtp>(
  "PasswordResetOtp",
  otpSchema,
);

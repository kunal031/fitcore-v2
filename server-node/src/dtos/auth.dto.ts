/**
 * Auth request schemas.
 *
 * Mirrors `server/app/schemas/auth.py`.
 */
import { z } from "zod";

import { emailSchema, lenientPhoneSchema, phoneSchema } from "./common.dto.js";
import { formatEmail, formatPhone, isValidEmail, isValidIndianPhone } from "../utils/phone.js";

export const registerSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: phoneSchema,
  email: emailSchema,
  password: z.string().min(6).max(100),
  referral_code: z.string().nullish(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login accepts either a phone number or an email address in one field.
 *
 * The presence of "@" decides which validator runs, matching the Python
 * `validate_identifier`.
 */
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1)
    .superRefine((value, ctx) => {
      const valid = value.includes("@")
        ? isValidEmail(value)
        : isValidIndianPhone(value);
      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: value.includes("@")
            ? "Please provide a valid email address."
            : "Must be a valid 10-digit Indian phone number or a valid email address.",
        });
      }
    })
    .transform((value) =>
      value.includes("@") ? formatEmail(value) : formatPhone(value),
    ),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const changePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(6).max(100),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: lenientPhoneSchema,
  otp: z.string().min(4).max(6),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const resetPasswordSchema = z.object({
  phone: lenientPhoneSchema,
  reset_token: z.string().min(1),
  new_password: z.string().min(6).max(100),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface UserBasicInfo {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  membership_status: string;
}

export interface TokenResponse {
  user: UserBasicInfo;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

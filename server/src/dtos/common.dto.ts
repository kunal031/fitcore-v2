/**
 * Shared validation primitives reused across domain DTOs.
 */
import { z } from "zod";

import { formatEmail, formatPhone, isValidIndianPhone } from "../utils/phone.js";

/**
 * An Indian phone number, normalised to `+91XXXXXXXXXX`.
 *
 * Validation runs on the raw input and normalisation on the way out, so
 * "98765 43210", "09876543210" and "+919876543210" all land in one form.
 */
export const phoneSchema = z
  .string()
  .refine(isValidIndianPhone, "Must be a valid 10-digit Indian phone number")
  .transform(formatPhone);

/**
 * A phone number that is normalised but not strictly validated.
 *
 * Used by verify-otp and reset-password, which apply
 * `format_phone` without the validity check.
 */
export const lenientPhoneSchema = z.string().transform(formatPhone);

/** An email address, trimmed and lowercased. */
export const emailSchema = z
  .string()
  .email("Please provide a valid email address.")
  .transform(formatEmail);

/** A 24-character hex MongoDB ObjectId. */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

/** Route params carrying a single id. */
export const idParamSchema = (key: string) =>
  z.object({ [key]: objectIdSchema });

/** Standard page/limit query, with the bounds the routes declare. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** A calendar date as `YYYY-MM-DD`. */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD format");

/**
 * A datetime accepted as an ISO string and converted to a Date.
 *
 * The frontend sends `valid_until` as an ISO string from a date input.
 */
export const dateTimeSchema = z.coerce.date();

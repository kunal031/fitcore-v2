/**
 * Random identifier generators.
 *
 * Mirrors `server/app/utils/generators.py`. Uniqueness is enforced by the
 * database's unique indexes; callers retry on collision.
 */
import { randomInt } from "node:crypto";

const UPPER_ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generate an uppercase alphanumeric referral code, optionally prefixed with
 * up to four letters taken from the member's name (e.g. "ARJUN8942").
 */
export function generateReferralCode(prefix = "", length = 6): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
  let random = "";
  for (let i = 0; i < length; i += 1) {
    random += UPPER_ALNUM[randomInt(UPPER_ALNUM.length)];
  }
  return cleanPrefix ? `${cleanPrefix}${random}` : `FIT${random}`;
}

/** Generate a receipt number in the form `FIT-2026-893412`. */
export function generateReceiptNumber(): string {
  const year = new Date().getUTCFullYear();
  return `FIT-${year}-${randomInt(100000, 1000000)}`;
}

/** Generate a zero-padded six-digit numeric OTP. */
export function generateOtp(): string {
  return String(randomInt(1000000)).padStart(6, "0");
}

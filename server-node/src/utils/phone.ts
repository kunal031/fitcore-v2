/**
 * Phone and email normalisation.
 *
 * Mirrors `server/app/utils/formatters.py`. Phone numbers are stored in a
 * single canonical form (+91XXXXXXXXXX) so lookups by phone are exact-match;
 * emails are stored lowercased for the same reason.
 */

/**
 * Standardise an Indian phone number to `+91XXXXXXXXXX`.
 *
 * Strips spaces, dashes and parentheses, then applies the same three cases as
 * the Python version. An input it does not recognise is returned cleaned but
 * otherwise unchanged, leaving validation to `isValidIndianPhone`.
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+91")) return cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 11) return `+91${cleaned.slice(1)}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned;
}

/** A valid Indian mobile number: 10 digits starting 6-9, optional +91 prefix. */
export function isValidIndianPhone(phone: string): boolean {
  return /^(\+91)?[6-9]\d{9}$/.test(phone.replace(/[\s\-]/g, ""));
}

/** Trim and lowercase an email address. */
export function formatEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Validate an email address against the same pattern the Python server uses. */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(
    email.trim(),
  );
}

/**
 * Escape a string for safe use inside a MongoDB `$regex`.
 *
 * The Python server interpolates user input straight into `$regex` for
 * case-insensitive email lookups and member search. Escaping here keeps the
 * same matching behaviour for ordinary input while preventing a stray `(` or
 * `*` in a search box from throwing a regex error.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

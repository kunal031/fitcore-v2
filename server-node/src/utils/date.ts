/**
 * Date helpers.
 *
 * Mirrors `server/app/utils/date_utils.py`. The Python server stores
 * `starts_on` / `expires_on` / `AttendanceEntry.date` as calendar dates with no
 * time component, and compares them in UTC. These helpers keep that contract:
 * calendar dates travel as `YYYY-MM-DD` strings so no timezone shift can move a
 * subscription's expiry by a day.
 */

/** Current timestamp. Stored as a real Date (BSON date) in MongoDB. */
export function getUtcNow(): Date {
  return new Date();
}

/** Today's UTC calendar date as `YYYY-MM-DD`. */
export function getTodayStr(): string {
  return toDateStr(new Date());
}

/** Format any Date as its UTC `YYYY-MM-DD` calendar date. */
export function toDateStr(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Parse a `YYYY-MM-DD` string into a UTC-midnight Date. */
export function parseDateStr(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Coerce a stored calendar date to `YYYY-MM-DD`.
 *
 * This server writes those fields as date strings, but the FastAPI server
 * stored them as BSON dates, so a database seeded by it hands back `Date`
 * objects (or full ISO strings). Normalising on read lets both sets of
 * documents work, which is what makes migrating without a data rewrite
 * possible. Returns null for anything unparseable rather than an
 * "Invalid Date" that would silently poison later arithmetic.
 */
export function toCalendarDateStr(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toDateStr(value);
  }
  if (typeof value === "string") {
    // Already in the canonical form.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : toDateStr(parsed);
  }
  return null;
}

/** Add whole days to a `YYYY-MM-DD` string, returning a new date string. */
export function addDaysToDateStr(value: string, days: number): string {
  const date = parseDateStr(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateStr(date);
}

/**
 * Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` is in
 * the past. Callers clamp with `Math.max(0, ...)` where the Python code does.
 */
export function daysBetween(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseDateStr(to).getTime() - parseDateStr(from).getTime()) / msPerDay);
}

/** ISO-8601 string, or null. Matches `format_iso`. */
export function formatIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** First instant of the month containing `value`, in UTC. */
export function startOfMonthUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

/** First instant of the month before the one containing `value`, in UTC. */
export function startOfPreviousMonthUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() - 1, 1));
}

/**
 * Format a date string as `DD Mon YYYY` — used in the check-in error message
 * that tells a member when their plan expired.
 */
export function formatDisplayDate(value: string): string {
  const date = parseDateStr(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${day} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

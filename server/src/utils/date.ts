/**
 * Date helpers.
 *
 * `starts_on`, `expires_on` and `AttendanceEntry.date` are calendar dates
 * with no time component, compared in UTC. These helpers keep that contract:
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
 * Current records store those fields as date strings, but records created
 * under an earlier schema hold BSON dates, so the database hands back `Date`
 * objects (or full ISO strings) for them. Normalising on read lets both sets
 * of documents work without a data rewrite. Returns null for anything
 * unparseable rather than an "Invalid Date" that would silently poison later
 * arithmetic.
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

/**
 * Build a filter matching a calendar-date field stored in either form.
 *
 * `npm run normalize-dates` has converted every stored calendar date to a
 * `YYYY-MM-DD` string, and the Node server only ever writes that form, so a
 * plain string bound is correct against a current database. This helper stays
 * because nothing guarantees the database a given deployment points at has been
 * migrated: a restored backup, an untouched environment or an import from the
 * Python-era server can all reintroduce BSON dates.
 *
 * It matters because MongoDB orders values of different BSON types by type
 * rather than by value, so a bound of one form silently skips every document
 * holding the other — no error, just a wrong answer. That failure mode is
 * invisible in review and has already cost three bugs, so the cost of matching
 * both forms is worth paying on the few queries that range over these fields.
 *
 * `$type` pins each branch to the form its bounds are written in, so a string
 * bound can never be compared against a date document or vice versa.
 *
 * The result must be handed to the raw driver, not to a Mongoose query: the
 * schema declares these fields as strings, so Mongoose would cast the Date
 * bounds back to strings and reintroduce the mismatch.
 *
 * Pass a half-open or closed range; omitted ends are simply left unbounded.
 */
export function calendarDateRangeFilter(
  field: string,
  range: { gte?: string; lte?: string; lt?: string },
): { $or: Record<string, unknown>[] } {
  const asString: Record<string, unknown> = { $type: "string" };
  const asDate: Record<string, unknown> = { $type: "date" };

  if (range.gte !== undefined) {
    asString["$gte"] = range.gte;
    asDate["$gte"] = parseDateStr(range.gte);
  }
  if (range.lte !== undefined) {
    asString["$lte"] = range.lte;
    // A stored date sits at UTC midnight, so an inclusive upper bound of the
    // same day matches it; no end-of-day padding is needed.
    asDate["$lte"] = parseDateStr(range.lte);
  }
  if (range.lt !== undefined) {
    asString["$lt"] = range.lt;
    asDate["$lt"] = parseDateStr(range.lt);
  }

  return { $or: [{ [field]: asString }, { [field]: asDate }] };
}

/** Add whole days to a `YYYY-MM-DD` string, returning a new date string. */
export function addDaysToDateStr(value: string, days: number): string {
  const date = parseDateStr(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateStr(date);
}

/**
 * Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` is in
 * the past. Callers clamp with `Math.max(0, ...)` where that matters.
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

/**
 * Normalise stored calendar dates to `YYYY-MM-DD` strings.
 *
 * Four fields are declared `String` in the schema but hold BSON dates on
 * records created by the earlier Python/Beanie server. MongoDB orders values
 * of different BSON types by type rather than by value, so a range query bound
 * to one form silently skips every document holding the other — no error, just
 * a wrong answer. That cost three separate bugs, most recently an
 * "expiring soon" count that read zero regardless of the data.
 *
 * The Node server already writes strings through these fields, so this is a
 * one-way catch-up for legacy rows rather than something that has to run
 * repeatedly. It is idempotent all the same: rows already in string form are
 * not matched.
 *
 * Deliberately NOT touched:
 *   - `coupons.valid_from` / `valid_until` and the same fields on plans, which
 *     are real timestamps (`Date` in the schema, compared against `now`), not
 *     calendar dates.
 *   - `created_at` / `updated_at` / `check_in_time`, likewise timestamps.
 *
 *   npm run normalize-dates -- --dry-run   # report only, change nothing
 *   npm run normalize-dates
 */
import { closeDatabaseConnection, connectToDatabase } from "../config/database.js";
import { COLLECTIONS } from "../config/constants.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { toDateStr } from "../utils/date.js";
import { logger } from "../utils/logger.js";

/** A calendar-date field to normalise, as `collection.path`. */
const TARGETS = [
  { collection: COLLECTIONS.SUBSCRIPTIONS, field: "starts_on" },
  { collection: COLLECTIONS.SUBSCRIPTIONS, field: "expires_on" },
  { collection: COLLECTIONS.USERS, field: "gym_meta.joined_on" },
  { collection: COLLECTIONS.USERS, field: "profile.dob" },
] as const;

/** Read a dotted path out of a document. */
function readPath(doc: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      doc,
    );
}

async function normalizeField(
  collectionName: string,
  field: string,
  dryRun: boolean,
): Promise<{ converted: number; skipped: number }> {
  const collection = Subscription.db.collection(collectionName);

  // Only documents still holding a date; string rows are already correct, so
  // re-running converts nothing.
  const stale = await collection
    .find({ [field]: { $type: "date" } }, { projection: { [field]: 1 } })
    .toArray();

  let converted = 0;
  let skipped = 0;

  for (const doc of stale) {
    const value = readPath(doc as Record<string, unknown>, field);
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      skipped += 1;
      continue;
    }

    // These are calendar dates: the stored instants sit at UTC midnight, and
    // the whole point of the string form is that no timezone can shift the
    // day. Formatting in UTC keeps the date that was originally meant.
    const asString = toDateStr(value);

    if (!dryRun) {
      // eslint-disable-next-line no-await-in-loop
      await collection.updateOne({ _id: doc._id }, { $set: { [field]: asString } });
    }
    converted += 1;
  }

  return { converted, skipped };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  await connectToDatabase();
  logger.info(
    dryRun
      ? "Normalising calendar dates (DRY RUN — nothing will be written)..."
      : "Normalising calendar dates to YYYY-MM-DD strings...",
  );

  let total = 0;
  for (const { collection, field } of TARGETS) {
    // eslint-disable-next-line no-await-in-loop
    const { converted, skipped } = await normalizeField(collection, field, dryRun);
    total += converted;
    logger.info(
      `  ${collection}.${field}: ${converted} to convert${skipped ? `, ${skipped} skipped (unparseable)` : ""}`,
    );
  }

  // Attendance dates live inside an array, so they need their own pass rather
  // than a field update. They are already strings in every known database;
  // this reports rather than rewrites, so a surprise is visible instead of
  // silently "fixed".
  const withDateEntries = await User.db
    .collection(COLLECTIONS.SUBSCRIPTIONS)
    .countDocuments({ "attendance_log.date": { $type: "date" } });
  if (withDateEntries > 0) {
    logger.warn(
      `  ${withDateEntries} subscription(s) hold date-typed attendance_log entries; these are not converted automatically.`,
    );
  }

  logger.info(
    dryRun
      ? `Dry run complete: ${total} value(s) would be converted.`
      : `Done: ${total} value(s) converted.`,
  );
  await closeDatabaseConnection();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Date normalisation failed.");
  process.exit(1);
});

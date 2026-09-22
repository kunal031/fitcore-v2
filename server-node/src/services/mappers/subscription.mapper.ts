/**
 * Document -> response mapping for subscriptions.
 *
 * `days_until_expiry` is derived at read time from today's date, and clamped
 * at zero so an overdue subscription reports 0 rather than a negative count.
 */
import type { SubscriptionDoc } from "../../models/Subscription.js";
import type { SubscriptionRead } from "../../dtos/subscription.dto.js";
import { daysBetween, getTodayStr, toCalendarDateStr } from "../../utils/date.js";

export function toSubscriptionRead(sub: SubscriptionDoc): SubscriptionRead {
  // Documents written by the FastAPI server hold BSON dates here rather than
  // `YYYY-MM-DD` strings, so both are normalised before any arithmetic.
  const today = getTodayStr();
  const startsOn = toCalendarDateStr(sub.starts_on) ?? today;
  const expiresOn = toCalendarDateStr(sub.expires_on) ?? today;
  const daysUntilExpiry = Math.max(0, daysBetween(today, expiresOn));

  return {
    id: String(sub._id),
    user_id: String(sub.user_id),
    plan_id: String(sub.plan_id),
    payment_id: String(sub.payment_id),
    plan_snapshot: {
      plan_name: sub.plan_snapshot.plan_name,
      price_paise: sub.plan_snapshot.price_paise,
      allocated_days: sub.plan_snapshot.allocated_days,
      calendar_days: sub.plan_snapshot.calendar_days,
      features: sub.plan_snapshot.features ?? [],
    },
    status: sub.status,
    allocated_days: sub.allocated_days,
    days_used: sub.days_used,
    days_remaining: sub.days_remaining,
    starts_on: startsOn,
    expires_on: expiresOn,
    days_until_expiry: daysUntilExpiry,
    attendance_log: (sub.attendance_log ?? []).map((entry) => ({
      date: toCalendarDateStr(entry.date) ?? entry.date,
      check_in_time: entry.check_in_time,
      check_out_time: entry.check_out_time ?? null,
      marked_by: String(entry.marked_by),
    })),
    created_at: sub.created_at,
  };
}

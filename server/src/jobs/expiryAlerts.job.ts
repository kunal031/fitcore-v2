/**
 * Morning renewal alerts.
 *
 * Mirrors `server/app/jobs/expiry_alerts.py`. Identifies members whose
 * subscription expires within a week.
 *
 * Notification delivery is not implemented: like the OTP flow, this currently
 * only logs. Hooking it to SMS or push is the remaining work.
 */
import { subscriptionRepository, userRepository } from "../repositories/index.js";
import {
  addDaysToDateStr,
  daysBetween,
  getTodayStr,
  toCalendarDateStr,
} from "../utils/date.js";
import { logger } from "../utils/logger.js";

const ALERT_WINDOW_DAYS = 7;

export async function sendExpiryAlerts(): Promise<number> {
  const today = getTodayStr();
  const targetDate = addDaysToDateStr(today, ALERT_WINDOW_DAYS);

  const expiring = await subscriptionRepository.listExpiringBetween(today, targetDate);
  const members = await userRepository.findManyByIds(
    expiring.map((sub) => sub.user_id),
  );

  let notified = 0;
  for (const subscription of expiring) {
    const user = members.get(String(subscription.user_id));
    if (!user) continue;

    const expiresOn = toCalendarDateStr(subscription.expires_on);
    if (!expiresOn) continue;
    const daysLeft = daysBetween(today, expiresOn);
    logger.debug(
      `Renewal Alert: ${user.full_name} (${user.phone}) expires in ${daysLeft} days.`,
    );
    notified += 1;
  }

  return notified;
}

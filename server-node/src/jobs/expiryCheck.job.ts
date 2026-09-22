/**
 * Nightly subscription expiry sweep.
 *
 * Mirrors `server/app/jobs/expiry_check.py`. Marks active subscriptions whose
 * calendar window has closed as `expired` and updates the member's membership
 * status to match.
 *
 * Reads also expire lazily (see `subscriptionService.getActiveSubscription`),
 * so this job is what keeps counts and listings correct for members who do not
 * open the app.
 */
import { MEMBERSHIP_STATUS, SUBSCRIPTION_STATUS } from "../config/constants.js";
import { subscriptionRepository, userRepository } from "../repositories/index.js";
import { getTodayStr } from "../utils/date.js";
import { logger } from "../utils/logger.js";

export async function checkAndExpireSubscriptions(): Promise<number> {
  const today = getTodayStr();
  const expiredSubs = await subscriptionRepository.listCalendarExpired(today);

  let count = 0;
  for (const subscription of expiredSubs) {
    subscription.status = SUBSCRIPTION_STATUS.EXPIRED;
    // eslint-disable-next-line no-await-in-loop
    await subscription.save();

    // eslint-disable-next-line no-await-in-loop
    const user = await userRepository.findById(subscription.user_id);
    // Only touch the member if this was the subscription they were on.
    if (user && String(user.active_subscription_id) === String(subscription._id)) {
      user.gym_meta.membership_status = MEMBERSHIP_STATUS.EXPIRED;
      // eslint-disable-next-line no-await-in-loop
      await user.save();
    }

    count += 1;
  }

  if (count > 0) {
    logger.info(`Subscription Expiry Job: Marked ${count} subscriptions as expired.`);
  }
  return count;
}

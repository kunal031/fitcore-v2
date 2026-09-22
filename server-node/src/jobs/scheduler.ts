/**
 * Background job scheduler.
 *
 * Mirrors `server/app/jobs/scheduler.py`. All three jobs run on India time,
 * because "midnight" for a gym means midnight locally, not UTC.
 *
 * Jobs are staggered rather than fired together so the expiry sweep finishes
 * before the coupon cleanup starts.
 */
import cron, { type ScheduledTask } from "node-cron";

import { SCHEDULER_TIMEZONE } from "../config/constants.js";
import { logger } from "../utils/logger.js";
import { cleanupExpiredCoupons } from "./couponCleanup.job.js";
import { sendExpiryAlerts } from "./expiryAlerts.job.js";
import { checkAndExpireSubscriptions } from "./expiryCheck.job.js";

const tasks: ScheduledTask[] = [];

/**
 * Run a job, logging any failure.
 *
 * A throwing job must not take the process down, and must not stop later runs
 * from being scheduled.
 */
function guard(name: string, job: () => Promise<unknown>): () => void {
  return () => {
    void job().catch((error: unknown) => {
      logger.error({ err: error }, `Scheduled job '${name}' failed`);
    });
  };
}

export function startScheduler(): void {
  const options = { timezone: SCHEDULER_TIMEZONE } as const;

  // 00:00 — expire subscriptions whose calendar window closed.
  tasks.push(
    cron.schedule(
      "0 0 * * *",
      guard("subscription_expiry_job", checkAndExpireSubscriptions),
      options,
    ),
  );

  // 00:05 — deactivate coupons past their validity date.
  tasks.push(
    cron.schedule(
      "5 0 * * *",
      guard("coupon_cleanup_job", cleanupExpiredCoupons),
      options,
    ),
  );

  // 09:00 — flag members due for renewal, at an hour worth contacting them.
  tasks.push(
    cron.schedule("0 9 * * *", guard("expiry_alerts_job", sendExpiryAlerts), options),
  );

  logger.info(`Background job scheduler started (${SCHEDULER_TIMEZONE} timezone).`);
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  logger.info("Background job scheduler stopped.");
}

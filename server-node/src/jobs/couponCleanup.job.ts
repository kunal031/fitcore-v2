/**
 * Nightly coupon cleanup.
 *
 * Mirrors `server/app/jobs/coupon_cleanup.py`. Deactivates coupons whose
 * validity window has closed, so the owner's list shows their real state.
 *
 * Validation independently rejects out-of-window coupons, so this job is
 * housekeeping rather than enforcement.
 */
import { couponRepository } from "../repositories/index.js";
import { getUtcNow } from "../utils/date.js";
import { logger } from "../utils/logger.js";

export async function cleanupExpiredCoupons(): Promise<number> {
  const now = getUtcNow();
  const expiredCoupons = await couponRepository.listExpiredActive(now);

  let count = 0;
  for (const coupon of expiredCoupons) {
    coupon.is_active = false;
    // eslint-disable-next-line no-await-in-loop
    await coupon.save();
    count += 1;
  }

  if (count > 0) {
    logger.info(`Coupon Cleanup Job: Deactivated ${count} expired coupons.`);
  }
  return count;
}

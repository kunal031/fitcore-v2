from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

from app.jobs.coupon_cleanup import cleanup_expired_coupons
from app.jobs.expiry_alerts import send_expiry_alerts
from app.jobs.expiry_check import check_and_expire_subscriptions

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


def start_scheduler() -> None:
    """Start APScheduler cron jobs."""
    # Midnight check: subscription calendar expiration
    scheduler.add_job(
        check_and_expire_subscriptions,
        "cron",
        hour=0,
        minute=0,
        id="subscription_expiry_job",
        replace_existing=True,
    )

    # 12:05 AM: coupon expiration cleanup
    scheduler.add_job(
        cleanup_expired_coupons,
        "cron",
        hour=0,
        minute=5,
        id="coupon_cleanup_job",
        replace_existing=True,
    )

    # 9:00 AM: renewal alerts
    scheduler.add_job(
        send_expiry_alerts,
        "cron",
        hour=9,
        minute=0,
        id="expiry_alerts_job",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Background job scheduler started (Asia/Kolkata timezone).")


def stop_scheduler() -> None:
    """Gracefully shutdown scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Background job scheduler stopped.")

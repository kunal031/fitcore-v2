from loguru import logger

from app.models.coupon import CouponDocument
from app.utils.date_utils import get_utc_now


async def cleanup_expired_coupons() -> None:
    """
    Scheduled job deactivating coupons whose validity period has elapsed.
    """
    now = get_utc_now()
    expired_coupons = await CouponDocument.find(
        CouponDocument.is_active == True,
        CouponDocument.valid_until < now,
    ).to_list()

    count = 0
    for c in expired_coupons:
        c.is_active = False
        c.updated_at = now
        await c.save()
        count += 1

    if count > 0:
        logger.info(f"Coupon Cleanup Job: Deactivated {count} expired coupons.")

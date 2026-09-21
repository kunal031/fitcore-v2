from datetime import timedelta
from loguru import logger

from app.models.subscription import SubscriptionDocument
from app.models.user import UserDocument
from app.utils.date_utils import get_utc_now


async def send_expiry_alerts() -> None:
    """
    Scheduled job identifying members whose subscription expires in 3 to 7 days
    to prepare renewal notifications.
    """
    now = get_utc_now()
    target_date = now.date() + timedelta(days=7)

    expiring = await SubscriptionDocument.find(
        SubscriptionDocument.status == "active",
        SubscriptionDocument.expires_on <= target_date,
        SubscriptionDocument.expires_on >= now.date(),
    ).to_list()

    for sub in expiring:
        user = await UserDocument.get(sub.user_id)
        if user:
            days_left = (sub.expires_on - now.date()).days
            logger.debug(
                f"Renewal Alert: {user.full_name} ({user.phone}) expires in {days_left} days."
            )

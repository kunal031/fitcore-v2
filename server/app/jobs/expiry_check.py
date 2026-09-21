from loguru import logger

from app.models.subscription import SubscriptionDocument
from app.models.user import UserDocument
from app.utils.date_utils import get_utc_now


async def check_and_expire_subscriptions() -> None:
    """
    Daily scheduled job running at midnight:
    Marks calendar-expired active subscriptions as 'expired'
    and updates member gym status.
    """
    today = get_utc_now().date()
    expired_subs = await SubscriptionDocument.find(
        SubscriptionDocument.status == "active",
        SubscriptionDocument.expires_on < today,
    ).to_list()

    count = 0
    for sub in expired_subs:
        sub.status = "expired"
        sub.updated_at = get_utc_now()
        await sub.save()

        # Update member status
        user = await UserDocument.get(sub.user_id)
        if user and user.active_subscription_id == sub.id:
            user.gym_meta.membership_status = "expired"
            user.updated_at = get_utc_now()
            await user.save()

        count += 1

    if count > 0:
        logger.info(f"Subscription Expiry Job: Marked {count} subscriptions as expired.")

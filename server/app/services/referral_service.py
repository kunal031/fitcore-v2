from typing import List

from beanie import PydanticObjectId

from app.models.referral import ReferralDocument
from app.models.user import UserDocument
from app.schemas.referral import (
    ReferralAdminSummary,
    ReferralRead,
    ReferralRewardInfo,
    ReferralStats,
    ReferredMemberRead,
)
from app.utils.date_utils import get_utc_now


class ReferralService:
    async def get_my_referral(self, user: UserDocument) -> ReferralRead:
        ref_doc = await ReferralDocument.find_one(
            ReferralDocument.referrer_user_id == user.id
        )
        if not ref_doc:
            # Reconnect stale seed data by referral code before creating a record.
            ref_doc = await ReferralDocument.find_one(
                ReferralDocument.referral_code == user.my_referral_code
            )
            if ref_doc:
                ref_doc.referrer_user_id = user.id
                await ref_doc.save()
            else:
                ref_doc = ReferralDocument(
                    referrer_user_id=user.id,
                    referral_code=user.my_referral_code,
                )
                await ref_doc.insert()

        referred_list = [
            ReferredMemberRead(
                user_id=str(m.user_id),
                full_name=m.full_name,
                joined_on=m.joined_on,
                has_purchased=m.has_purchased,
                reward_issued=m.reward_issued,
            )
            for m in ref_doc.referred_members
        ]

        return ReferralRead(
            my_referral_code=ref_doc.referral_code,
            shareable_link=f"https://fitcore.in/join?ref={ref_doc.referral_code}",
            referrer_reward=ReferralRewardInfo(
                type=ref_doc.referrer_reward_type,
                value=ref_doc.referrer_reward_value,
            ),
            referee_reward=ReferralRewardInfo(
                type=ref_doc.referee_discount_type,
                value=ref_doc.referee_discount_value,
            ),
            stats=ReferralStats(
                total_referrals=ref_doc.total_referrals,
                successful_joins=ref_doc.successful_conversions,
                total_points_earned=user.loyalty_points,
            ),
            referred_members=referred_list,
        )

    async def list_all_admin(self) -> List[ReferralAdminSummary]:
        docs = await ReferralDocument.find_all().sort("-created_at").to_list()
        items = []
        for d in docs:
            referrer = await UserDocument.get(d.referrer_user_id)
            items.append(
                ReferralAdminSummary(
                    id=str(d.id),
                    referrer_user_id=str(d.referrer_user_id),
                    referrer_name=referrer.full_name if referrer else "Unknown",
                    referrer_phone=referrer.phone if referrer else "",
                    referral_code=d.referral_code,
                    total_referrals=d.total_referrals,
                    successful_conversions=d.successful_conversions,
                    is_active=d.is_active,
                    created_at=d.created_at,
                )
            )
        return items

    async def issue_reward_on_purchase(
        self,
        referee_user_id: PydanticObjectId,
        referral_code: str,
    ) -> None:
        clean_code = referral_code.strip().upper()
        ref_doc = await ReferralDocument.find_one(
            ReferralDocument.referral_code == clean_code
        )
        if not ref_doc:
            return

        # Mark referee as purchased in referrer doc
        updated = False
        for m in ref_doc.referred_members:
            if m.user_id == referee_user_id and not m.reward_issued:
                m.has_purchased = True
                m.reward_issued = True
                updated = True
                break

        if updated:
            ref_doc.successful_conversions += 1
            ref_doc.updated_at = get_utc_now()
            await ref_doc.save()

            # Award points to referrer
            referrer_user = await UserDocument.get(ref_doc.referrer_user_id)
            if referrer_user:
                referrer_user.loyalty_points += ref_doc.referrer_reward_value
                referrer_user.updated_at = get_utc_now()
                await referrer_user.save()


referral_service = ReferralService()

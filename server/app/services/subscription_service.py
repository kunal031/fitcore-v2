from datetime import date, datetime, timedelta
from typing import List, Optional
from beanie import PydanticObjectId

from app.core.exceptions import ConflictException, NotFoundException
from app.models.plan import PlanDocument
from app.models.subscription import (
    AttendanceEntry,
    PlanSnapshot,
    SubscriptionDocument,
)
from app.models.user import UserDocument
from app.schemas.subscription import (
    AttendanceEntryRead,
    ExpiringSubscriptionItem,
    PlanSnapshotRead,
    SubscriptionRead,
)
from app.utils.date_utils import get_utc_now


class SubscriptionService:
    @staticmethod
    def to_subscription_read(s: SubscriptionDocument) -> SubscriptionRead:
        now_date = get_utc_now().date()
        days_left_calendar = max(0, (s.expires_on - now_date).days)

        return SubscriptionRead(
            id=str(s.id),
            user_id=str(s.user_id),
            plan_id=str(s.plan_id),
            payment_id=str(s.payment_id),
            plan_snapshot=PlanSnapshotRead(
                plan_name=s.plan_snapshot.plan_name,
                price_paise=s.plan_snapshot.price_paise,
                allocated_days=s.plan_snapshot.allocated_days,
                calendar_days=s.plan_snapshot.calendar_days,
                features=s.plan_snapshot.features,
            ),
            status=s.status,
            allocated_days=s.allocated_days,
            days_used=s.days_used,
            days_remaining=s.days_remaining,
            starts_on=s.starts_on,
            expires_on=s.expires_on,
            days_until_expiry=days_left_calendar,
            attendance_log=[
                AttendanceEntryRead(
                    date=e.date,
                    check_in_time=e.check_in_time,
                    check_out_time=e.check_out_time,
                    marked_by=str(e.marked_by),
                )
                for e in s.attendance_log
            ],
            created_at=s.created_at,
        )

    async def create_subscription(
        self,
        user_id: PydanticObjectId,
        plan_id: PydanticObjectId,
        payment_id: PydanticObjectId,
    ) -> SubscriptionDocument:
        plan = await PlanDocument.get(plan_id)
        if not plan:
            raise NotFoundException("Plan not found", "PLAN_NOT_FOUND")

        # Mark any previous active subscription as superseded/expired
        previous_active = await SubscriptionDocument.find(
            SubscriptionDocument.user_id == user_id,
            SubscriptionDocument.status == "active",
        ).to_list()
        for prev in previous_active:
            prev.status = "expired"
            prev.updated_at = get_utc_now()
            await prev.save()

        starts_on = get_utc_now().date()
        expires_on = starts_on + timedelta(days=plan.calendar_days)

        snapshot = PlanSnapshot(
            plan_name=plan.plan_name,
            price_paise=plan.price_paise,
            allocated_days=plan.allocated_days,
            calendar_days=plan.calendar_days,
            features=plan.features,
        )

        sub = SubscriptionDocument(
            user_id=user_id,
            plan_id=plan_id,
            payment_id=payment_id,
            plan_snapshot=snapshot,
            status="active",
            allocated_days=plan.allocated_days,
            days_used=0,
            days_remaining=plan.allocated_days,
            starts_on=starts_on,
            expires_on=expires_on,
            attendance_log=[],
        )
        await sub.insert()

        # Update member record
        user = await UserDocument.get(user_id)
        if user:
            user.active_subscription_id = sub.id
            user.gym_meta.membership_status = "active"
            user.updated_at = get_utc_now()
            await user.save()

        return sub

    async def get_active_subscription(self, user_id: str) -> Optional[SubscriptionRead]:
        sub = await SubscriptionDocument.find_one(
            SubscriptionDocument.user_id == PydanticObjectId(user_id),
            SubscriptionDocument.status == "active",
        )
        if not sub:
            return None

        # Check if expired by calendar date
        today = get_utc_now().date()
        if today > sub.expires_on:
            sub.status = "expired"
            sub.updated_at = get_utc_now()
            await sub.save()
            return None

        return self.to_subscription_read(sub)

    async def get_history(self, user_id: str) -> List[SubscriptionRead]:
        subs = await SubscriptionDocument.find(
            SubscriptionDocument.user_id == PydanticObjectId(user_id)
        ).sort("-created_at").to_list()
        return [self.to_subscription_read(s) for s in subs]

    async def get_by_id(self, sub_id: str) -> SubscriptionRead:
        sub = await SubscriptionDocument.get(PydanticObjectId(sub_id))
        if not sub:
            raise NotFoundException("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
        return self.to_subscription_read(sub)

    async def get_expiring(self, days: int = 7) -> List[ExpiringSubscriptionItem]:
        today = get_utc_now().date()
        target_date = today + timedelta(days=days)

        subs = await SubscriptionDocument.find(
            SubscriptionDocument.status == "active",
            SubscriptionDocument.expires_on <= target_date,
            SubscriptionDocument.expires_on >= today,
        ).to_list()

        results = []
        for s in subs:
            member = await UserDocument.get(s.user_id)
            days_left = max(0, (s.expires_on - today).days)
            results.append(
                ExpiringSubscriptionItem(
                    subscription_id=str(s.id),
                    member_id=str(s.user_id),
                    member_name=member.full_name if member else "Unknown",
                    member_phone=member.phone if member else "",
                    plan_name=s.plan_snapshot.plan_name,
                    days_remaining=s.days_remaining,
                    expires_on=s.expires_on,
                    days_until_expiry=days_left,
                )
            )
        return results

    async def pause(self, sub_id: str) -> SubscriptionRead:
        sub = await SubscriptionDocument.get(PydanticObjectId(sub_id))
        if not sub:
            raise NotFoundException("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
        sub.status = "paused"
        sub.updated_at = get_utc_now()
        await sub.save()
        return self.to_subscription_read(sub)

    async def resume(self, sub_id: str) -> SubscriptionRead:
        sub = await SubscriptionDocument.get(PydanticObjectId(sub_id))
        if not sub:
            raise NotFoundException("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
        sub.status = "active"
        sub.updated_at = get_utc_now()
        await sub.save()
        return self.to_subscription_read(sub)

    async def cancel(self, sub_id: str) -> SubscriptionRead:
        sub = await SubscriptionDocument.get(PydanticObjectId(sub_id))
        if not sub:
            raise NotFoundException("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
        sub.status = "cancelled"
        sub.updated_at = get_utc_now()
        await sub.save()

        # Update member status
        user = await UserDocument.get(sub.user_id)
        if user and user.active_subscription_id == sub.id:
            user.active_subscription_id = None
            user.gym_meta.membership_status = "inactive"
            user.updated_at = get_utc_now()
            await user.save()

        return self.to_subscription_read(sub)


subscription_service = SubscriptionService()

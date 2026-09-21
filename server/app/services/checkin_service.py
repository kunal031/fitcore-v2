from datetime import datetime
from typing import List, Optional
from beanie import PydanticObjectId

from app.core.exceptions import (
    ForbiddenException,
    NotFoundException,
    ValidationException,
)
from app.models.subscription import AttendanceEntry, SubscriptionDocument
from app.models.user import UserDocument
from app.schemas.checkin import (
    CheckInMemberSummary,
    CheckInRequest,
    CheckInResult,
    TodayCheckInItem,
)
from app.utils.date_utils import get_today_str, get_utc_now


class CheckInService:
    async def mark_attendance(
        self,
        payload: CheckInRequest,
        marked_by_id: PydanticObjectId,
    ) -> CheckInResult:
        # 1. Identify member
        member: Optional[UserDocument] = None
        if payload.member_id:
            try:
                member = await UserDocument.get(PydanticObjectId(payload.member_id))
            except Exception:
                raise NotFoundException("Member ID format is invalid", "INVALID_MEMBER_ID")
        elif payload.phone:
            member = await UserDocument.find_one(UserDocument.phone == payload.phone)

        if not member:
            raise NotFoundException("Member not found", "MEMBER_NOT_FOUND")

        # 2. Check active subscription
        sub = await SubscriptionDocument.find_one(
            SubscriptionDocument.user_id == member.id,
            SubscriptionDocument.status == "active",
        )
        if not sub:
            raise ForbiddenException(
                message=f"{member.full_name} does not have an active gym plan.",
                error_code="NO_ACTIVE_SUBSCRIPTION",
            )

        # 3. Check calendar expiry
        today_date = get_utc_now().date()
        if today_date > sub.expires_on:
            sub.status = "expired"
            sub.updated_at = get_utc_now()
            await sub.save()
            raise ForbiddenException(
                message=f"{member.full_name}'s plan expired on {sub.expires_on.strftime('%d %b %Y')}.",
                error_code="SUBSCRIPTION_EXPIRED",
            )

        # 4. Check quota
        if sub.days_remaining <= 0:
            sub.status = "exhausted"
            sub.updated_at = get_utc_now()
            await sub.save()
            raise ForbiddenException(
                message=f"{member.full_name} has exhausted all {sub.allocated_days} allocated days.",
                error_code="QUOTA_EXHAUSTED",
            )

        # 5. Check if today already logged
        today_str = get_today_str()
        now_dt = get_utc_now()
        dates_logged = [e.date for e in sub.attendance_log]

        is_first_today = today_str not in dates_logged

        if is_first_today:
            # Deduct 1 day and add attendance entry
            sub.attendance_log.append(
                AttendanceEntry(
                    date=today_str,
                    check_in_time=now_dt,
                    marked_by=marked_by_id,
                )
            )
            sub.days_used += 1
            sub.days_remaining -= 1

            if sub.days_remaining == 0:
                sub.status = "exhausted"

            sub.updated_at = now_dt
            await sub.save()
        else:
            # Re-entry on same day: allow entry, don't deduct day again
            pass

        return CheckInResult(
            member=CheckInMemberSummary(
                id=str(member.id),
                full_name=member.full_name,
                phone=member.phone,
                avatar_url=member.profile.avatar_url,
            ),
            check_in_time=now_dt,
            days_remaining=sub.days_remaining,
            allocated_days=sub.allocated_days,
            is_first_today=is_first_today,
        )

    async def get_today_checkins(self) -> List[TodayCheckInItem]:
        today_str = get_today_str()
        subs = await SubscriptionDocument.find(
            {"attendance_log.date": today_str}
        ).to_list()

        results = []
        for s in subs:
            member = await UserDocument.get(s.user_id)
            if not member:
                continue

            # Find today's entry
            today_entry = next((e for e in s.attendance_log if e.date == today_str), None)
            if today_entry:
                results.append(
                    TodayCheckInItem(
                        member=CheckInMemberSummary(
                            id=str(member.id),
                            full_name=member.full_name,
                            phone=member.phone,
                            avatar_url=member.profile.avatar_url,
                        ),
                        check_in_time=today_entry.check_in_time,
                        days_remaining=s.days_remaining,
                    )
                )

        # Sort newest checkin first
        results.sort(key=lambda x: x.check_in_time, reverse=True)
        return results

    async def get_member_attendance(self, member_id: str) -> List[AttendanceEntry]:
        subs = await SubscriptionDocument.find(
            SubscriptionDocument.user_id == PydanticObjectId(member_id)
        ).to_list()

        all_logs = []
        for s in subs:
            all_logs.extend(s.attendance_log)

        all_logs.sort(key=lambda x: x.check_in_time, reverse=True)
        return all_logs


checkin_service = CheckInService()

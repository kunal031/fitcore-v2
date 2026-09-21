from datetime import datetime, timedelta, timezone
from typing import List

from app.models.payment import PaymentDocument
from app.models.plan import PlanDocument
from app.models.subscription import SubscriptionDocument
from app.models.user import UserDocument
from app.schemas.dashboard import (
    LastCheckInInfo,
    OwnerDashboardResponse,
    OwnerDashboardStats,
    PopularPlanInfo,
    RecentPaymentItem,
    TrainerDashboardResponse,
)
from app.utils.date_utils import get_today_str, get_utc_now


class DashboardService:
    async def get_owner_dashboard(self) -> OwnerDashboardResponse:
        total_members = await UserDocument.find(UserDocument.role == "member").count()
        active_subs = await SubscriptionDocument.find(
            SubscriptionDocument.status == "active"
        ).count()
        expired_subs = await SubscriptionDocument.find(
            SubscriptionDocument.status == "expired"
        ).count()

        # Checkins today
        today_str = get_today_str()
        checkins_today = await SubscriptionDocument.find(
            {"attendance_log.date": today_str}
        ).count()

        # Revenue calculations
        now = get_utc_now()
        start_this_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 1:
            start_last_month = datetime(now.year - 1, 12, 1, tzinfo=timezone.utc)
        else:
            start_last_month = datetime(now.year, now.month - 1, 1, tzinfo=timezone.utc)

        payments_this_month = await PaymentDocument.find(
            PaymentDocument.status == "success",
            PaymentDocument.created_at >= start_this_month,
        ).to_list()
        rev_this_month = sum(p.final_amount_paise for p in payments_this_month)

        payments_last_month = await PaymentDocument.find(
            PaymentDocument.status == "success",
            PaymentDocument.created_at >= start_last_month,
            PaymentDocument.created_at < start_this_month,
        ).to_list()
        rev_last_month = sum(p.final_amount_paise for p in payments_last_month)

        if rev_last_month > 0:
            change_pct = round(((rev_this_month - rev_last_month) / rev_last_month) * 100, 1)
        else:
            change_pct = 0.0

        # Expiring in 7 days
        target_date = now.date() + timedelta(days=7)
        expiring_count = await SubscriptionDocument.find(
            SubscriptionDocument.status == "active",
            SubscriptionDocument.expires_on <= target_date,
            SubscriptionDocument.expires_on >= now.date(),
        ).count()

        # Recent 5 payments
        recent_p = await PaymentDocument.find(
            PaymentDocument.status == "success"
        ).sort("-created_at").limit(5).to_list()

        recent_items = []
        for p in recent_p:
            member = await UserDocument.get(p.user_id)
            plan = await PlanDocument.get(p.plan_id)
            recent_items.append(
                RecentPaymentItem(
                    member_name=member.full_name if member else "Unknown",
                    plan_name=plan.plan_name if plan else "Gym Plan",
                    amount_paise=p.final_amount_paise,
                    created_at=p.created_at,
                )
            )

        # Most popular plan
        plans = await PlanDocument.find_all().to_list()
        popular_info = None
        max_active = -1
        for pl in plans:
            c = await SubscriptionDocument.find(
                SubscriptionDocument.plan_id == pl.id,
                SubscriptionDocument.status == "active",
            ).count()
            if c > max_active:
                max_active = c
                popular_info = PopularPlanInfo(plan_name=pl.plan_name, active_count=c)

        return OwnerDashboardResponse(
            stats=OwnerDashboardStats(
                total_members=total_members,
                active_subscriptions=active_subs,
                expired_subscriptions=expired_subs,
                checkins_today=checkins_today,
                revenue_this_month_paise=rev_this_month,
                revenue_last_month_paise=rev_last_month,
                revenue_change_percent=change_pct,
            ),
            expiring_soon_count=expiring_count,
            recent_payments=recent_items,
            popular_plan=popular_info,
        )

    async def get_trainer_dashboard(self) -> TrainerDashboardResponse:
        today_str = get_today_str()
        checkins_today = await SubscriptionDocument.find(
            {"attendance_log.date": today_str}
        ).count()

        now = get_utc_now()
        target_date = now.date() + timedelta(days=7)
        expiring_count = await SubscriptionDocument.find(
            SubscriptionDocument.status == "active",
            SubscriptionDocument.expires_on <= target_date,
            SubscriptionDocument.expires_on >= now.date(),
        ).count()

        # Find latest checkin today
        subs_today = await SubscriptionDocument.find(
            {"attendance_log.date": today_str}
        ).to_list()

        latest_entry = None
        latest_member_name = None
        for s in subs_today:
            for e in s.attendance_log:
                if e.date == today_str:
                    if not latest_entry or e.check_in_time > latest_entry.check_in_time:
                        latest_entry = e
                        mem = await UserDocument.get(s.user_id)
                        latest_member_name = mem.full_name if mem else "Member"

        last_info = None
        if latest_entry and latest_member_name:
            last_info = LastCheckInInfo(
                member_name=latest_member_name,
                time=latest_entry.check_in_time,
            )

        return TrainerDashboardResponse(
            checkins_today=checkins_today,
            expiring_soon_count=expiring_count,
            last_checkin=last_info,
        )


dashboard_service = DashboardService()

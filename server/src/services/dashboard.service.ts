/**
 * Dashboard aggregations.
 *
 * Mirrors `server/app/services/dashboard_service.py`.
 *
 * These are read-only rollups over several collections. Independent queries
 * are issued concurrently, and per-plan and per-member lookups are batched, so
 * a dashboard load is a handful of round trips rather than one per row.
 */
import { ROLES, SUBSCRIPTION_STATUS } from "../config/constants.js";
import type {
  OwnerDashboardResponse,
  PopularPlanInfo,
  TrainerDashboardResponse,
} from "../dtos/dashboard.dto.js";
import {
  paymentRepository,
  planRepository,
  subscriptionRepository,
  userRepository,
} from "../repositories/index.js";
import {
  addDaysToDateStr,
  getTodayStr,
  getUtcNow,
  startOfMonthUtc,
  startOfPreviousMonthUtc,
} from "../utils/date.js";

/** Renewal window used by both dashboards. */
const EXPIRING_SOON_DAYS = 7;

/** Month-over-month change as a percentage, rounded to one decimal place. */
function revenueChangePercent(thisMonth: number, lastMonth: number): number {
  if (lastMonth <= 0) return 0;
  return Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10;
}

export const dashboardService = {
  /** Headline numbers, recent activity and the most-subscribed plan. */
  async getOwnerDashboard(): Promise<OwnerDashboardResponse> {
    const now = getUtcNow();
    const todayStr = getTodayStr();
    const expiringCutoff = addDaysToDateStr(todayStr, EXPIRING_SOON_DAYS);
    const startThisMonth = startOfMonthUtc(now);
    const startLastMonth = startOfPreviousMonthUtc(now);

    const [
      totalMembers,
      activeSubs,
      expiredSubs,
      checkinsToday,
      revenueThisMonth,
      revenueLastMonth,
      expiringCount,
      recentPayments,
      activeByPlan,
      plans,
    ] = await Promise.all([
      userRepository.countByRole(ROLES.MEMBER),
      subscriptionRepository.countByStatus(SUBSCRIPTION_STATUS.ACTIVE),
      subscriptionRepository.countByStatus(SUBSCRIPTION_STATUS.EXPIRED),
      subscriptionRepository.countWithAttendanceOn(todayStr),
      paymentRepository.sumRevenueBetween(startThisMonth),
      paymentRepository.sumRevenueBetween(startLastMonth, startThisMonth),
      subscriptionRepository.countExpiringBetween(todayStr, expiringCutoff),
      paymentRepository.listRecentSuccessful(5),
      subscriptionRepository.countActiveByPlan(),
      planRepository.listAll(),
    ]);

    // Resolve the names behind the recent payments in two batched queries.
    const [members, paymentPlans] = await Promise.all([
      userRepository.findManyByIds(recentPayments.map((p) => p.user_id)),
      planRepository.findManyByIds(recentPayments.map((p) => p.plan_id)),
    ]);

    const recentItems = recentPayments.map((payment) => ({
      member_name: members.get(String(payment.user_id))?.full_name ?? "Unknown",
      plan_name: paymentPlans.get(String(payment.plan_id))?.plan_name ?? "Gym Plan",
      amount_paise: payment.final_amount_paise,
      created_at: payment.created_at,
    }));

    // Most-subscribed plan. Every plan is considered, including those with no
    // subscribers, so the reported plan may be one with a
    // zero count when nothing has sold.
    let popularPlan: PopularPlanInfo | null = null;
    let maxActive = -1;
    for (const plan of plans) {
      const count = activeByPlan.get(String(plan._id)) ?? 0;
      if (count > maxActive) {
        maxActive = count;
        popularPlan = { plan_name: plan.plan_name, active_count: count };
      }
    }

    return {
      stats: {
        total_members: totalMembers,
        active_subscriptions: activeSubs,
        expired_subscriptions: expiredSubs,
        checkins_today: checkinsToday,
        revenue_this_month_paise: revenueThisMonth,
        revenue_last_month_paise: revenueLastMonth,
        revenue_change_percent: revenueChangePercent(
          revenueThisMonth,
          revenueLastMonth,
        ),
      },
      expiring_soon_count: expiringCount,
      recent_payments: recentItems,
      popular_plan: popularPlan,
    };
  },

  /** The floor view: today's attendance, renewals due, and the last check-in. */
  async getTrainerDashboard(): Promise<TrainerDashboardResponse> {
    const todayStr = getTodayStr();
    const expiringCutoff = addDaysToDateStr(todayStr, EXPIRING_SOON_DAYS);

    const [checkinsToday, expiringCount, subsToday] = await Promise.all([
      subscriptionRepository.countWithAttendanceOn(todayStr),
      subscriptionRepository.countExpiringBetween(todayStr, expiringCutoff),
      subscriptionRepository.listWithAttendanceOn(todayStr),
    ]);

    // Find today's most recent entry across all subscriptions.
    let latestTime: Date | null = null;
    let latestUserId: string | null = null;

    for (const subscription of subsToday) {
      for (const entry of subscription.attendance_log) {
        if (entry.date !== todayStr) continue;
        if (!latestTime || entry.check_in_time > latestTime) {
          latestTime = entry.check_in_time;
          latestUserId = String(subscription.user_id);
        }
      }
    }

    let lastCheckin = null;
    if (latestTime && latestUserId) {
      const member = await userRepository.findById(latestUserId);
      lastCheckin = {
        member_name: member?.full_name ?? "Member",
        time: latestTime,
      };
    }

    return {
      checkins_today: checkinsToday,
      expiring_soon_count: expiringCount,
      last_checkin: lastCheckin,
    };
  },
};

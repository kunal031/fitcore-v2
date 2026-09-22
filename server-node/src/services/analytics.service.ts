/**
 * Owner analytics.
 *
 * Read-only rollups for the admin analytics screen. Everything here is
 * computed with aggregations and set arithmetic rather than per-row queries,
 * so the whole page costs a handful of round trips regardless of gym size.
 */
import { MEMBERSHIP_STATUS, SUBSCRIPTION_STATUS } from "../config/constants.js";
import type {
  AnalyticsResponse,
  MemberAnalytics,
  MemberCohort,
  PlanAnalytics,
  PlanBreakdownItem,
} from "../dtos/dashboard.dto.js";
import type { UserRead } from "../dtos/user.dto.js";
import { toUserRead } from "./mappers/index.js";
import {
  paymentRepository,
  planRepository,
  subscriptionRepository,
  userRepository,
} from "../repositories/index.js";
import { getTodayStr } from "../utils/date.js";

/** First day of the current month, as a `YYYY-MM-DD` calendar date. */
function startOfMonthStr(): string {
  return `${getTodayStr().slice(0, 7)}-01`;
}

export const analyticsService = {
  /**
   * Membership and plan analytics.
   *
   * The two halves are independent, so they run concurrently.
   */
  async getAnalytics(): Promise<AnalyticsResponse> {
    const [members, plans] = await Promise.all([
      this.getMemberAnalytics(),
      this.getPlanAnalytics(),
    ]);
    return { members, plans };
  },

  /**
   * Who the members are and where they stand.
   *
   * `lapsed` is the win-back list: members who bought before, whose plan has
   * since ended, and who have not started a new one. It is derived by set
   * difference — everyone who ever subscribed, minus those currently holding
   * a live plan — rather than trusting membership_status, which a stale
   * record could misreport.
   */
  async getMemberAnalytics(): Promise<MemberAnalytics> {
    const [
      totalRegistered,
      byStatus,
      suspended,
      joinedThisMonth,
      memberIds,
      everSubscribed,
      currentlyHolding,
    ] = await Promise.all([
      userRepository.countByRole("member"),
      userRepository.countMembersByStatus(),
      userRepository.countInactiveAccounts(),
      userRepository.countMembersJoinedSince(startOfMonthStr()),
      userRepository.listMemberIds(),
      subscriptionRepository.listUserIdsWithAnySubscription(),
      // Paused still counts as holding a plan: the member has not lapsed,
      // their plan is on hold.
      subscriptionRepository.listUserIdsByStatus([
        SUBSCRIPTION_STATUS.ACTIVE,
        SUBSCRIPTION_STATUS.PAUSED,
      ]),
    ]);

    const memberIdSet = new Set(memberIds);
    let neverSubscribed = 0;
    let lapsed = 0;

    for (const id of memberIdSet) {
      if (!everSubscribed.has(id)) {
        neverSubscribed += 1;
      } else if (!currentlyHolding.has(id)) {
        lapsed += 1;
      }
    }

    return {
      total_registered: totalRegistered,
      active: byStatus.get(MEMBERSHIP_STATUS.ACTIVE) ?? 0,
      inactive:
        (byStatus.get(MEMBERSHIP_STATUS.INACTIVE) ?? 0) +
        (byStatus.get(MEMBERSHIP_STATUS.EXPIRED) ?? 0),
      never_subscribed: neverSubscribed,
      lapsed,
      suspended,
      joined_this_month: joinedThisMonth,
    };
  },

  /**
   * The members behind one analytics figure.
   *
   * Each cohort is derived the same way the count is, so a row and its list
   * can never disagree — the alternative, re-deriving membership here, is how
   * a drill-down starts showing a different number from the row that opened
   * it.
   */
  async getMemberCohort(cohort: MemberCohort): Promise<UserRead[]> {
    if (cohort === "suspended") {
      const users = await userRepository.listSuspendedMembers();
      return users.map(toUserRead);
    }

    if (cohort === "joined_this_month") {
      const users = await userRepository.listMembersJoinedSince(startOfMonthStr());
      return users.map(toUserRead);
    }

    if (cohort === "active" || cohort === "inactive") {
      const status =
        cohort === "active" ? [MEMBERSHIP_STATUS.ACTIVE] : [MEMBERSHIP_STATUS.INACTIVE, MEMBERSHIP_STATUS.EXPIRED];
      const users = await userRepository.listMembersByStatus(status);
      return users.map(toUserRead);
    }

    // lapsed / never_subscribed: the same set arithmetic the counts use.
    const [memberIds, everSubscribed, currentlyHolding] = await Promise.all([
      userRepository.listMemberIds(),
      subscriptionRepository.listUserIdsWithAnySubscription(),
      subscriptionRepository.listUserIdsByStatus([
        SUBSCRIPTION_STATUS.ACTIVE,
        SUBSCRIPTION_STATUS.PAUSED,
      ]),
    ]);

    const wanted = memberIds.filter((id) =>
      cohort === "never_subscribed"
        ? !everSubscribed.has(id)
        : everSubscribed.has(id) && !currentlyHolding.has(id),
    );

    const users = await userRepository.listMembersByIds(wanted);
    return users.map(toUserRead);
  },

  /**
   * Plan catalogue performance.
   *
   * `most_bought` and `least_bought` rank on lifetime sales rather than
   * current members, so a plan that sold well historically is not hidden by
   * everyone's subscription having since expired. Plans that never sold are
   * excluded from "least bought" — the interesting comparison is between
   * plans people actually bought.
   */
  async getPlanAnalytics(): Promise<PlanAnalytics> {
    const [plans, byPlan, revenueByPlan] = await Promise.all([
      planRepository.listAll(),
      subscriptionRepository.countAllByPlan(),
      paymentRepository.sumRevenueByPlan(),
    ]);

    const breakdown: PlanBreakdownItem[] = plans.map((plan) => {
      const key = String(plan._id);
      const counts = byPlan.get(key) ?? { active: 0, total: 0 };
      return {
        plan_id: key,
        plan_name: plan.plan_name,
        is_active: plan.is_active,
        price_paise: plan.price_paise,
        active_members: counts.active,
        total_sold: counts.total,
        revenue_paise: revenueByPlan.get(key) ?? 0,
      };
    });

    // Sorted for the chart: busiest plan first.
    breakdown.sort((a, b) => b.active_members - a.active_members || b.total_sold - a.total_sold);

    const sold = breakdown.filter((item) => item.total_sold > 0);
    const byVolume = [...sold].sort((a, b) => b.total_sold - a.total_sold);

    return {
      total_plans: plans.length,
      active_plans: plans.filter((plan) => plan.is_active).length,
      inactive_plans: plans.filter((plan) => !plan.is_active).length,
      most_bought: byVolume[0] ?? null,
      least_bought: byVolume.length > 1 ? byVolume[byVolume.length - 1]! : null,
      breakdown,
    };
  },
};

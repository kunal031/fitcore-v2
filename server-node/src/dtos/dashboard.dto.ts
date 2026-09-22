/**
 * Dashboard response shapes.
 *
 * Mirrors `server/app/schemas/dashboard.py`. These are read-only aggregations.
 */

export interface OwnerDashboardStats {
  total_members: number;
  active_subscriptions: number;
  expired_subscriptions: number;
  checkins_today: number;
  revenue_this_month_paise: number;
  revenue_last_month_paise: number;
  /** Month-over-month change; 0 when there is no prior-month revenue to compare. */
  revenue_change_percent: number;
}

export interface RecentPaymentItem {
  member_name: string;
  plan_name: string;
  amount_paise: number;
  created_at: Date;
}

export interface PopularPlanInfo {
  plan_name: string;
  active_count: number;
}

export interface OwnerDashboardResponse {
  stats: OwnerDashboardStats;
  expiring_soon_count: number;
  recent_payments: RecentPaymentItem[];
  popular_plan: PopularPlanInfo | null;
}

export interface LastCheckInInfo {
  member_name: string;
  time: Date;
}

export interface TrainerDashboardResponse {
  checkins_today: number;
  expiring_soon_count: number;
  last_checkin: LastCheckInInfo | null;
}

// ── Analytics ──────────────────────────────────────────────────────────────

export interface MemberAnalytics {
  total_registered: number;
  active: number;
  inactive: number;
  /** Never bought a plan. */
  never_subscribed: number;
  /**
   * Bought before, plan has since expired, and they have not renewed.
   * The win-back list.
   */
  lapsed: number;
  /** Deactivated accounts, excluded from the active/inactive split above. */
  suspended: number;
  joined_this_month: number;
}

export interface PlanBreakdownItem {
  plan_id: string;
  plan_name: string;
  is_active: boolean;
  price_paise: number;
  /** Members currently on this plan. */
  active_members: number;
  /** Every subscription ever sold against it, including expired. */
  total_sold: number;
  revenue_paise: number;
}

export interface PlanAnalytics {
  total_plans: number;
  active_plans: number;
  inactive_plans: number;
  most_bought: PlanBreakdownItem | null;
  least_bought: PlanBreakdownItem | null;
  /** Per-plan figures, for the chart. Sorted by members, descending. */
  breakdown: PlanBreakdownItem[];
}

export interface AnalyticsResponse {
  members: MemberAnalytics;
  plans: PlanAnalytics;
}

/** Which membership cohort to list. Mirrors the analytics rows. */
export const MEMBER_COHORTS = [
  "active",
  "inactive",
  "lapsed",
  "never_subscribed",
  "suspended",
  "joined_this_month",
] as const;
export type MemberCohort = (typeof MEMBER_COHORTS)[number];

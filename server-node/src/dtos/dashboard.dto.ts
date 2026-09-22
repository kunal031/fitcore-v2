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

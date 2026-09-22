import { api } from "../lib/axios";

export interface MemberAnalytics {
	total_registered: number;
	active: number;
	inactive: number;
	/** Registered but never bought a plan. */
	never_subscribed: number;
	/** Bought before, plan has ended, not renewed — the win-back list. */
	lapsed: number;
	suspended: number;
	joined_this_month: number;
}

export interface PlanBreakdownItem {
	plan_id: string;
	plan_name: string;
	is_active: boolean;
	price_paise: number;
	active_members: number;
	total_sold: number;
	revenue_paise: number;
}

export interface PlanAnalytics {
	total_plans: number;
	active_plans: number;
	inactive_plans: number;
	most_bought: PlanBreakdownItem | null;
	least_bought: PlanBreakdownItem | null;
	/** Sorted by current members, descending — chart order. */
	breakdown: PlanBreakdownItem[];
}

export interface Analytics {
	members: MemberAnalytics;
	plans: PlanAnalytics;
}

/** Membership and plan analytics. Owner only. */
export async function getAnalytics() {
	const response = await api.get<{ data: Analytics }>("/dashboard/analytics");
	return response.data.data;
}

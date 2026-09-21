import { api } from "../lib/axios";

export interface ReferralInfo {
	my_referral_code: string;
	shareable_link: string;
	stats: { total_referrals: number; successful_joins: number; total_points_earned: number };
	referred_members: { user_id: string; full_name: string; joined_on: string; has_purchased: boolean; reward_issued: boolean }[];
}

export async function getMyReferrals() {
	const response = await api.get<{ data: ReferralInfo }>("/referrals/me");
	return response.data.data;
}

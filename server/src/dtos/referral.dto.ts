/**
 * Referral response shapes.
 *
 * Mirrors `server/app/schemas/referral.py`. Referral records are created as a
 * side effect of registration, so there are no request bodies here.
 */

export interface ReferredMemberRead {
  user_id: string;
  full_name: string;
  joined_on: Date;
  has_purchased: boolean;
  reward_issued: boolean;
}

export interface ReferralRewardInfo {
  type: string;
  value: number;
}

export interface ReferralStats {
  total_referrals: number;
  successful_joins: number;
  total_points_earned: number;
}

export interface ReferralRead {
  my_referral_code: string;
  shareable_link: string;
  referrer_reward: ReferralRewardInfo;
  referee_reward: ReferralRewardInfo;
  stats: ReferralStats;
  referred_members: ReferredMemberRead[];
}

export interface ReferralAdminSummary {
  id: string;
  referrer_user_id: string;
  referrer_name: string;
  referrer_phone: string;
  referral_code: string;
  total_referrals: number;
  successful_conversions: number;
  is_active: boolean;
  created_at: Date;
}

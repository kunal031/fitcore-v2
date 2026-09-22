/**
 * Referral programme.
 *
 * Mirrors `server/app/services/referral_service.py`.
 *
 * Two-sided: the referee gets a discount on their first purchase, and the
 * referrer earns loyalty points — but only once that referee actually pays.
 * Signing up alone earns nothing, which is what stops the scheme being farmed
 * with throwaway accounts.
 */
import type {
  ReferralAdminSummary,
  ReferralRead,
} from "../dtos/referral.dto.js";
import type { ReferralDoc } from "../models/Referral.js";
import type { UserDoc } from "../models/User.js";
import { referralRepository, userRepository } from "../repositories/index.js";
import { getUtcNow } from "../utils/date.js";
import type { Types } from "mongoose";

/** Base URL used to build the shareable signup link. */
const SHARE_BASE_URL = "https://fitcore.in/join";

export const referralService = {
  /**
   * The member's own referral record, creating it if absent.
   *
   * Older seeded accounts have a referral document keyed only by code, with no
   * `referrer_user_id`. Those are repaired in place here rather than being
   * duplicated. See KNOWN_ISSUES.md.
   */
  async getMyReferral(user: UserDoc): Promise<ReferralRead> {
    let referralDoc: ReferralDoc | null = await referralRepository.findByUserId(
      user._id,
    );

    if (!referralDoc) {
      // Reconnect a stale seed record by its code before creating a new one.
      referralDoc = await referralRepository.findByCode(user.my_referral_code);
      if (referralDoc) {
        referralDoc.referrer_user_id = user._id;
        await referralDoc.save();
      } else {
        referralDoc = await referralRepository.create({
          referrer_user_id: user._id,
          referral_code: user.my_referral_code,
        });
      }
    }

    return {
      my_referral_code: referralDoc.referral_code,
      shareable_link: `${SHARE_BASE_URL}?ref=${referralDoc.referral_code}`,
      referrer_reward: {
        type: referralDoc.referrer_reward_type,
        value: referralDoc.referrer_reward_value,
      },
      referee_reward: {
        type: referralDoc.referee_discount_type,
        value: referralDoc.referee_discount_value,
      },
      stats: {
        total_referrals: referralDoc.total_referrals,
        successful_joins: referralDoc.successful_conversions,
        // Lifetime points, which may also include non-referral awards.
        total_points_earned: user.loyalty_points,
      },
      referred_members: referralDoc.referred_members.map((member) => ({
        user_id: String(member.user_id),
        full_name: member.full_name,
        joined_on: member.joined_on,
        has_purchased: member.has_purchased,
        reward_issued: member.reward_issued,
      })),
    };
  },

  /** Every referral record with its owner resolved. Owner only. */
  async listAllAdmin(): Promise<ReferralAdminSummary[]> {
    const docs = await referralRepository.listAll();
    const referrers = await userRepository.findManyByIds(
      docs.map((doc) => doc.referrer_user_id),
    );

    return docs.map((doc) => {
      const referrer = referrers.get(String(doc.referrer_user_id));
      return {
        id: String(doc._id),
        referrer_user_id: String(doc.referrer_user_id),
        referrer_name: referrer?.full_name ?? "Unknown",
        referrer_phone: referrer?.phone ?? "",
        referral_code: doc.referral_code,
        total_referrals: doc.total_referrals,
        successful_conversions: doc.successful_conversions,
        is_active: doc.is_active,
        created_at: doc.created_at,
      };
    });
  },

  /**
   * Credit the referrer once their referee completes a purchase.
   *
   * Called from payment verification. `reward_issued` makes this idempotent:
   * a repeated call for the same referee finds nothing to update and pays out
   * nothing further.
   */
  async issueRewardOnPurchase(
    refereeUserId: Types.ObjectId,
    referralCode: string,
  ): Promise<void> {
    const cleanCode = referralCode.trim().toUpperCase();
    const referralDoc = await referralRepository.findByCode(cleanCode);
    if (!referralDoc) return;

    const entry = referralDoc.referred_members.find(
      (member) =>
        String(member.user_id) === String(refereeUserId) && !member.reward_issued,
    );
    if (!entry) return;

    entry.has_purchased = true;
    entry.reward_issued = true;
    referralDoc.successful_conversions += 1;
    referralDoc.updated_at = getUtcNow();
    await referralDoc.save();

    const referrer = await userRepository.findById(referralDoc.referrer_user_id);
    if (referrer) {
      referrer.loyalty_points += referralDoc.referrer_reward_value;
      await referrer.save();
    }
  },
};

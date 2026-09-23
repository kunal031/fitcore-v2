/**
 * Document -> response mapping for users.
 *
 * Kept separate from the service so the wire format is defined in exactly one
 * place. Note `hashed_password` and `token_version` are never mapped.
 */
import type { UserDoc } from "../../models/User.js";
import type { UserRead } from "../../dtos/user.dto.js";
import { toCalendarDateStr } from "../../utils/date.js";

export function toUserRead(user: UserDoc): UserRead {
  const address = user.profile?.address ?? {
    street: null,
    city: null,
    state: null,
    pincode: null,
  };

  return {
    id: String(user._id),
    full_name: user.full_name,
    phone: user.phone,
    email: user.email ?? null,
    role: user.role,
    profile: {
      dob: toCalendarDateStr(user.profile?.dob) ?? null,
      blood_group: user.profile?.blood_group ?? null,
      gender: user.profile?.gender ?? null,
      avatar_url: user.profile?.avatar_url ?? null,
      address: {
        street: address.street ?? null,
        city: address.city ?? null,
        state: address.state ?? null,
        pincode: address.pincode ?? null,
      },
    },
    gym_meta: {
      // Normalised on read: a migrated database holds a YYYY-MM-DD string,
      // but an unmigrated one can still hold a BSON date here.
      joined_on: toCalendarDateStr(user.gym_meta.joined_on) ?? user.gym_meta.joined_on,
      membership_status: user.gym_meta.membership_status,
      assigned_trainer_id: user.gym_meta.assigned_trainer_id
        ? String(user.gym_meta.assigned_trainer_id)
        : null,
      // Resolved by the service for `GET /users/me`; null on list responses.
      assigned_trainer_name: null,
    },
    active_subscription_id: user.active_subscription_id
      ? String(user.active_subscription_id)
      : null,
    my_referral_code: user.my_referral_code,
    loyalty_points: user.loyalty_points,
    is_active: user.is_active,
  };
}

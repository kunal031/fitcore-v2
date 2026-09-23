/**
 * User request/response schemas.
 *
 * Mirrors `server/app/schemas/user.py`.
 */
import { z } from "zod";

import { ROLES } from "../config/constants.js";
import { dateStringSchema, emailSchema, objectIdSchema, phoneSchema } from "./common.dto.js";

const addressUpdateSchema = z.object({
  street: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  pincode: z.string().nullish(),
});

/**
 * Self-service profile update.
 *
 * Phone is absent by design — it cannot change after registration. Email is
 * accepted but the service rejects any attempt to change one already set.
 */
export const userProfileUpdateSchema = z.object({
  full_name: z.string().min(2).max(100).nullish(),
  email: emailSchema.nullish(),
  dob: dateStringSchema.nullish(),
  blood_group: z.string().nullish(),
  gender: z.string().nullish(),
  avatar_url: z.string().nullish(),
  address: addressUpdateSchema.nullish(),
});
export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;

/** Owner-created account, for walk-in members and new trainers. */
export const userCreateManualSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: phoneSchema,
  password: z.string().min(6),
  role: z.enum([ROLES.MEMBER, ROLES.TRAINER]).default(ROLES.MEMBER),
  email: emailSchema.nullish(),
});
export type UserCreateManualInput = z.infer<typeof userCreateManualSchema>;

export const userStatusUpdateSchema = z.object({
  is_active: z.boolean().nullish(),
  membership_status: z.string().nullish(),
});
export type UserStatusUpdateInput = z.infer<typeof userStatusUpdateSchema>;

export const assignTrainerSchema = z.object({
  trainer_id: objectIdSchema,
});
export type AssignTrainerInput = z.infer<typeof assignTrainerSchema>;

/** Filters for the staff-facing member list. */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  /**
   * Restrict to the members assigned to one trainer.
   *
   * An owner may pass any trainer id. For a trainer the service applies its
   * own scoping regardless, so this cannot be used to widen what they see.
   */
  assigned_trainer_id: objectIdSchema.optional(),
  /**
   * Opt into the member's current plan on each row. Off by default, so the
   * lists that do not need it do not pay for the extra query.
   */
  include: z.literal("subscription").optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface AddressRead {
  street: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface ProfileRead {
  dob: string | null;
  blood_group: string | null;
  gender: string | null;
  avatar_url: string | null;
  address: AddressRead;
}

export interface GymMetaRead {
  joined_on: string;
  membership_status: string;
  assigned_trainer_id: string | null;
  /** Resolved by `GET /users/me` and, in one batched lookup, by the list. */
  assigned_trainer_name: string | null;
}

/**
 * The member's current plan, folded into a list row.
 *
 * Present only when the caller asks for it, and null for a member who has
 * never bought a plan.
 *
 * `status` is the subscription's own status, not a boolean: a plan ends on two
 * independent axes, and an `exhausted` member (visit quota spent) is a
 * different case from an `expired` one (calendar window closed). Collapsing
 * the two would label an exhausted member active.
 */
export interface MemberSubscriptionSummary {
  subscription_id: string;
  plan_name: string;
  status: string;
  /** Visit quota left. */
  days_remaining: number;
  /** Calendar days left — a different number from the quota. */
  days_until_expiry: number;
  expires_on: string;
}

export interface UserRead {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: string;
  profile: ProfileRead;
  gym_meta: GymMetaRead;
  active_subscription_id: string | null;
  my_referral_code: string;
  loyalty_points: number;
  is_active: boolean;
  /** Set only when the list was asked for `include=subscription`. */
  subscription?: MemberSubscriptionSummary | null;
}

export interface MemberQrRead {
  member_id: string;
  qr_data: string;
}

/**
 * User document — members, trainers and the owner all live in one collection,
 * separated by `role`.
 *
 * Maps onto the existing `users` collection written by the Python/Beanie
 * server, so field names stay snake_case and the schema stays structurally
 * identical. `_id` is the Mongo ObjectId.
 */
import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { COLLECTIONS, MEMBERSHIP_STATUS, ROLES } from "../config/constants.js";
import { getTodayStr } from "../utils/date.js";

export interface Address {
  street: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface UserProfile {
  /** Calendar date as `YYYY-MM-DD`. Stored as a string to avoid timezone drift. */
  dob: string | null;
  blood_group: string | null;
  gender: string | null;
  avatar_url: string | null;
  address: Address;
}

export interface GymMeta {
  /** Calendar date as `YYYY-MM-DD`. */
  joined_on: string;
  membership_status: string;
  assigned_trainer_id: Types.ObjectId | null;
}

export interface IUser {
  phone: string;
  hashed_password: string;
  role: string;
  full_name: string;
  email: string | null;
  profile: UserProfile;
  gym_meta: GymMeta;
  active_subscription_id: Types.ObjectId | null;
  my_referral_code: string;
  referred_by_code: string | null;
  loyalty_points: number;
  /** Bumped on logout to invalidate every previously issued token. */
  token_version: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type UserDoc = HydratedDocument<IUser>;

const addressSchema = new Schema<Address>(
  {
    street: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    pincode: { type: String, default: null },
  },
  { _id: false },
);

const profileSchema = new Schema<UserProfile>(
  {
    dob: { type: String, default: null },
    blood_group: { type: String, default: null },
    gender: { type: String, default: null },
    avatar_url: { type: String, default: null },
    address: { type: addressSchema, default: () => ({}) },
  },
  { _id: false },
);

const gymMetaSchema = new Schema<GymMeta>(
  {
    joined_on: { type: String, default: getTodayStr },
    membership_status: { type: String, default: MEMBERSHIP_STATUS.INACTIVE },
    assigned_trainer_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    phone: { type: String, required: true, unique: true, index: true },
    hashed_password: { type: String, required: true },
    role: { type: String, default: ROLES.MEMBER, index: true },
    full_name: { type: String, required: true },
    email: { type: String, default: null },
    profile: { type: profileSchema, default: () => ({}) },
    gym_meta: { type: gymMetaSchema, default: () => ({}) },
    active_subscription_id: { type: Schema.Types.ObjectId, default: null },
    my_referral_code: { type: String, required: true, unique: true, index: true },
    referred_by_code: { type: String, default: null },
    loyalty_points: { type: Number, default: 0 },
    token_version: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  {
    collection: COLLECTIONS.USERS,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false,
  },
);

// Supports the member-list search, which filters by role and membership status.
userSchema.index({ role: 1, "gym_meta.membership_status": 1 });

export const User = model<IUser>("User", userSchema);

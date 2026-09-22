/**
 * User queries.
 *
 * Every read or write against the `users` collection goes through here, so the
 * shape of those queries is reviewable in one place.
 */
import type { FilterQuery, Types } from "mongoose";

import { ROLES } from "../config/constants.js";
import { User, type IUser, type UserDoc } from "../models/User.js";
import { escapeRegex } from "../utils/phone.js";

export interface ListUsersFilters {
  page: number;
  limit: number;
  search?: string | undefined;
  role?: string | undefined;
  membershipStatus?: string | undefined;
}

export const userRepository = {
  findById(id: Types.ObjectId | string): Promise<UserDoc | null> {
    return User.findById(id).exec();
  },

  findByPhone(phone: string): Promise<UserDoc | null> {
    return User.findOne({ phone }).exec();
  },

  /** Case-insensitive email lookup, matching the Python `$regex` behaviour. */
  findByEmail(email: string): Promise<UserDoc | null> {
    return User.findOne({
      email: { $regex: `^${escapeRegex(email.trim().toLowerCase())}$`, $options: "i" },
    }).exec();
  },

  findByReferralCode(code: string): Promise<UserDoc | null> {
    return User.findOne({ my_referral_code: code }).exec();
  },

  create(data: Partial<IUser>): Promise<UserDoc> {
    return User.create(data);
  },

  /** Members and trainers, filtered and paginated for the staff member list. */
  async listPaginated(
    filters: ListUsersFilters,
  ): Promise<{ items: UserDoc[]; total: number }> {
    const query: FilterQuery<IUser> = {};

    if (filters.role) query.role = filters.role;
    if (filters.membershipStatus) {
      query["gym_meta.membership_status"] = filters.membershipStatus;
    }
    if (filters.search) {
      const pattern = escapeRegex(filters.search);
      query.$or = [
        { full_name: { $regex: pattern, $options: "i" } },
        { phone: { $regex: pattern, $options: "i" } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
      User.find(query).sort({ created_at: -1 }).skip(skip).limit(filters.limit).exec(),
      User.countDocuments(query).exec(),
    ]);

    return { items, total };
  },

  listActiveTrainers(): Promise<UserDoc[]> {
    return User.find({ role: ROLES.TRAINER, is_active: true }).exec();
  },

  countByRole(role: string): Promise<number> {
    return User.countDocuments({ role }).exec();
  },

  /**
   * Resolve several users at once, returned as an id-keyed map.
   *
   * Used wherever a list needs member names, to avoid a lookup per row.
   */
  async findManyByIds(
    ids: (Types.ObjectId | string)[],
  ): Promise<Map<string, UserDoc>> {
    if (ids.length === 0) return new Map();
    const unique = [...new Set(ids.map(String))];
    const users = await User.find({ _id: { $in: unique } }).exec();
    return new Map(users.map((user) => [String(user._id), user]));
  },
};

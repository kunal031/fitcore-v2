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

  /** Members by membership status, in one aggregation. */
  async countMembersByStatus(): Promise<Map<string, number>> {
    const rows = await User.aggregate<{ _id: string; count: number }>([
      { $match: { role: ROLES.MEMBER } },
      { $group: { _id: "$gym_meta.membership_status", count: { $sum: 1 } } },
    ]).exec();
    return new Map(rows.map((row) => [row._id, row.count]));
  },

  /** Members whose account has been deactivated. */
  countInactiveAccounts(): Promise<number> {
    return User.countDocuments({ role: ROLES.MEMBER, is_active: false }).exec();
  },

  /**
   * Members who joined on or after the given calendar date.
   *
   * `joined_on` is stored two ways: this server writes a YYYY-MM-DD string,
   * while records created by the FastAPI server hold a BSON date. MongoDB
   * compares across BSON types by type order, so a single `$gte` matches only
   * one of them — a string bound silently skips every date record, and the
   * count came back near zero.
   *
   * The query goes through the raw driver because the schema declares this
   * field a string, so Mongoose would cast the Date bound back to a string
   * and reintroduce the mismatch.
   */
  countMembersJoinedSince(dateStr: string): Promise<number> {
    return User.collection.countDocuments({
      role: ROLES.MEMBER,
      $or: [
        { "gym_meta.joined_on": { $gte: dateStr, $type: "string" } },
        { "gym_meta.joined_on": { $gte: new Date(`${dateStr}T00:00:00.000Z`), $type: "date" } },
      ],
    });
  },

  /** Ids of every member, for set arithmetic against subscription holders. */
  async listMemberIds(): Promise<string[]> {
    const ids = await User.distinct("_id", { role: ROLES.MEMBER }).exec();
    return ids.map(String);
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

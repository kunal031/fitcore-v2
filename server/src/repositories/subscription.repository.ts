/**
 * Subscription queries.
 *
 * Calendar dates (`starts_on`, `expires_on`) are stored two ways: Node-era
 * records hold `YYYY-MM-DD` strings, Python-era ones hold BSON dates. Any
 * range filter on them goes through `calendarDateRangeFilter`, which matches
 * both forms — a bound of one form silently skips the other.
 */
import type { Types } from "mongoose";

import { SUBSCRIPTION_STATUS } from "../config/constants.js";
import { calendarDateRangeFilter } from "../utils/date.js";
import {
  Subscription,
  type ISubscription,
  type SubscriptionDoc,
} from "../models/Subscription.js";

export const subscriptionRepository = {
  findById(id: Types.ObjectId | string): Promise<SubscriptionDoc | null> {
    return Subscription.findById(id).exec();
  },

  findActiveByUser(userId: Types.ObjectId | string): Promise<SubscriptionDoc | null> {
    return Subscription.findOne({
      user_id: userId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    }).exec();
  },

  listAllActiveByUser(userId: Types.ObjectId | string): Promise<SubscriptionDoc[]> {
    return Subscription.find({
      user_id: userId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    }).exec();
  },

  /** Full purchase history, newest first. */
  listByUser(userId: Types.ObjectId | string): Promise<SubscriptionDoc[]> {
    return Subscription.find({ user_id: userId }).sort({ created_at: -1 }).exec();
  },

  create(data: Partial<ISubscription>): Promise<SubscriptionDoc> {
    return Subscription.create(data);
  },

  /**
   * Active subscriptions expiring between today and `targetDate`, inclusive.
   *
   * Goes through the raw driver to find the matching ids, then re-reads them
   * as documents: the mixed-form bounds cannot survive Mongoose's casting, but
   * callers still expect hydrated documents.
   */
  async listExpiringBetween(
    today: string,
    targetDate: string,
  ): Promise<SubscriptionDoc[]> {
    const ids = await this.idsExpiringBetween(today, targetDate);
    if (ids.length === 0) return [];
    return Subscription.find({ _id: { $in: ids } }).exec();
  },

  countExpiringBetween(today: string, targetDate: string): Promise<number> {
    return Subscription.collection.countDocuments({
      status: SUBSCRIPTION_STATUS.ACTIVE,
      ...calendarDateRangeFilter("expires_on", { gte: today, lte: targetDate }),
    });
  },

  /** Ids only, for callers that re-read or count rather than hydrate. */
  async idsExpiringBetween(today: string, targetDate: string): Promise<Types.ObjectId[]> {
    const rows = await Subscription.collection
      .find(
        {
          status: SUBSCRIPTION_STATUS.ACTIVE,
          ...calendarDateRangeFilter("expires_on", { gte: today, lte: targetDate }),
        },
        { projection: { _id: 1 } },
      )
      .toArray();
    return rows.map((row) => row._id as Types.ObjectId);
  },

  /** Active subscriptions whose window has already closed. Drives the nightly sweep. */
  async listCalendarExpired(today: string): Promise<SubscriptionDoc[]> {
    const rows = await Subscription.collection
      .find(
        {
          status: SUBSCRIPTION_STATUS.ACTIVE,
          ...calendarDateRangeFilter("expires_on", { lt: today }),
        },
        { projection: { _id: 1 } },
      )
      .toArray();
    if (rows.length === 0) return [];
    return Subscription.find({ _id: { $in: rows.map((row) => row._id) } }).exec();
  },

  countByStatus(status: string): Promise<number> {
    return Subscription.countDocuments({ status }).exec();
  },

  /** Subscriptions with an attendance entry on the given date. */
  listWithAttendanceOn(dateStr: string): Promise<SubscriptionDoc[]> {
    return Subscription.find({ "attendance_log.date": dateStr }).exec();
  },

  countWithAttendanceOn(dateStr: string): Promise<number> {
    return Subscription.countDocuments({ "attendance_log.date": dateStr }).exec();
  },

  /**
   * Every subscription ever sold, grouped by plan.
   *
   * Returns both the current members and the lifetime count per plan, in one
   * round trip, for the analytics breakdown.
   */
  async countAllByPlan(): Promise<Map<string, { active: number; total: number }>> {
    const rows = await Subscription.aggregate<{
      _id: Types.ObjectId;
      total: number;
      active: number;
    }>([
      {
        $group: {
          _id: "$plan_id",
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", SUBSCRIPTION_STATUS.ACTIVE] }, 1, 0] },
          },
        },
      },
    ]).exec();

    return new Map(rows.map((row) => [String(row._id), { active: row.active, total: row.total }]));
  },

  /** Distinct members who have ever held a subscription. */
  async listUserIdsWithAnySubscription(): Promise<Set<string>> {
    const ids = await Subscription.distinct("user_id").exec();
    return new Set(ids.map(String));
  },

  /** Distinct members holding a subscription in any of the given states. */
  async listUserIdsByStatus(statuses: string[]): Promise<Set<string>> {
    const ids = await Subscription.distinct("user_id", { status: { $in: statuses } }).exec();
    return new Set(ids.map(String));
  },

  /**
   * Count active subscriptions per plan in one aggregation.
   *
   * A count per plan would be one query each; this collapses that into a
   * single round trip while returning the same numbers.
   */
  async countActiveByPlan(): Promise<Map<string, number>> {
    const rows = await Subscription.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: SUBSCRIPTION_STATUS.ACTIVE } },
      { $group: { _id: "$plan_id", count: { $sum: 1 } } },
    ]).exec();
    return new Map(rows.map((row) => [String(row._id), row.count]));
  },
};

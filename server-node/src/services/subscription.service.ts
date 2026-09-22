/**
 * Subscription lifecycle.
 *
 * Mirrors `server/app/services/subscription_service.py`.
 *
 * A subscription is bounded on two independent axes:
 *
 *   calendar   `starts_on` .. `expires_on`, a wall-clock window.
 *   quota      `allocated_days` visits, decremented once per attended day.
 *
 * Whichever runs out first ends the subscription: the window closing makes it
 * `expired`, the quota reaching zero makes it `exhausted`. `days_remaining`
 * (visits left) and `days_until_expiry` (calendar days left) are different
 * numbers and are reported separately.
 */
import { MEMBERSHIP_STATUS, SUBSCRIPTION_STATUS } from "../config/constants.js";
import type {
  ExpiringSubscriptionItem,
  SubscriptionRead,
} from "../dtos/subscription.dto.js";
import { NotFoundError } from "../errors/index.js";
import type { SubscriptionDoc } from "../models/Subscription.js";
import {
  planRepository,
  subscriptionRepository,
  userRepository,
} from "../repositories/index.js";
import {
  addDaysToDateStr,
  daysBetween,
  getTodayStr,
  getUtcNow,
  toCalendarDateStr,
} from "../utils/date.js";
import { toObjectId } from "../utils/objectId.js";
import { toSubscriptionRead } from "./mappers/index.js";
import type { Types } from "mongoose";

export const subscriptionService = {
  /**
   * Create a subscription for a verified payment.
   *
   * Called only by the payment service, never directly from a route. Any
   * subscription the member already holds is marked `expired` first, so a
   * member has at most one active plan at a time and the new purchase always
   * wins.
   */
  async createSubscription(
    userId: Types.ObjectId,
    planId: Types.ObjectId,
    paymentId: Types.ObjectId,
  ): Promise<SubscriptionDoc> {
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found", "PLAN_NOT_FOUND");
    }

    // Supersede any currently active subscription.
    const previousActive = await subscriptionRepository.listAllActiveByUser(userId);
    for (const previous of previousActive) {
      previous.status = SUBSCRIPTION_STATUS.EXPIRED;
      // eslint-disable-next-line no-await-in-loop
      await previous.save();
    }

    const startsOn = getTodayStr();
    const expiresOn = addDaysToDateStr(startsOn, plan.calendar_days);

    // The plan's terms are frozen here; later edits to the plan do not apply.
    const subscription = await subscriptionRepository.create({
      user_id: userId,
      plan_id: planId,
      payment_id: paymentId,
      plan_snapshot: {
        plan_name: plan.plan_name,
        price_paise: plan.price_paise,
        allocated_days: plan.allocated_days,
        calendar_days: plan.calendar_days,
        features: plan.features,
      },
      status: SUBSCRIPTION_STATUS.ACTIVE,
      allocated_days: plan.allocated_days,
      days_used: 0,
      days_remaining: plan.allocated_days,
      starts_on: startsOn,
      expires_on: expiresOn,
      attendance_log: [],
    });

    // Point the member at their new subscription and mark them active.
    const user = await userRepository.findById(userId);
    if (user) {
      user.active_subscription_id = subscription._id;
      user.gym_meta.membership_status = MEMBERSHIP_STATUS.ACTIVE;
      await user.save();
    }

    return subscription;
  },

  /**
   * The member's current subscription, or null.
   *
   * Lazily expires a subscription whose window has closed but which the
   * nightly job has not yet swept, so the member never sees a stale "active"
   * plan between midnight and the job running.
   */
  async getActiveSubscription(userId: string): Promise<SubscriptionRead | null> {
    const subscription = await subscriptionRepository.findActiveByUser(userId);
    if (!subscription) return null;

    // Normalise first: documents written by the FastAPI server hold a BSON
    // date here, and comparing that against "YYYY-MM-DD" as a string is wrong.
    const expiresOn = toCalendarDateStr(subscription.expires_on);
    if (expiresOn && getTodayStr() > expiresOn) {
      subscription.status = SUBSCRIPTION_STATUS.EXPIRED;
      await subscription.save();
      return null;
    }

    return toSubscriptionRead(subscription);
  },

  /** Every subscription the member has ever held, newest first. */
  async getHistory(userId: string): Promise<SubscriptionRead[]> {
    const subscriptions = await subscriptionRepository.listByUser(userId);
    return subscriptions.map(toSubscriptionRead);
  },

  async getById(subId: string): Promise<SubscriptionRead> {
    const subscription = await subscriptionRepository.findById(
      toObjectId(subId, "Subscription not found", "SUBSCRIPTION_NOT_FOUND"),
    );
    if (!subscription) {
      throw new NotFoundError("Subscription not found", "SUBSCRIPTION_NOT_FOUND");
    }
    return toSubscriptionRead(subscription);
  },

  /**
   * Subscriptions expiring within `days`, for the renewal-chasing screens.
   *
   * Member details are fetched in one batched query rather than one per row.
   */
  async getExpiring(days = 7): Promise<ExpiringSubscriptionItem[]> {
    const today = getTodayStr();
    const targetDate = addDaysToDateStr(today, days);

    const subscriptions = await subscriptionRepository.listExpiringBetween(
      today,
      targetDate,
    );
    const members = await userRepository.findManyByIds(
      subscriptions.map((sub) => sub.user_id),
    );

    return subscriptions.map((sub) => {
      const member = members.get(String(sub.user_id));
      const expiresOn = toCalendarDateStr(sub.expires_on) ?? today;
      return {
        subscription_id: String(sub._id),
        member_id: String(sub.user_id),
        member_name: member?.full_name ?? "Unknown",
        member_phone: member?.phone ?? "",
        plan_name: sub.plan_snapshot.plan_name,
        days_remaining: sub.days_remaining,
        expires_on: expiresOn,
        days_until_expiry: Math.max(0, daysBetween(today, expiresOn)),
      };
    });
  },

  /**
   * Pause a subscription. Owner only.
   *
   * Note the paused plan's `expires_on` is not extended — the calendar window
   * keeps running. This matches the Python behaviour; see KNOWN_ISSUES.md.
   */
  async pause(subId: string): Promise<SubscriptionRead> {
    return this.setStatus(subId, SUBSCRIPTION_STATUS.PAUSED);
  },

  /** Resume a paused subscription. Owner only. */
  async resume(subId: string): Promise<SubscriptionRead> {
    return this.setStatus(subId, SUBSCRIPTION_STATUS.ACTIVE);
  },

  /**
   * Cancel a subscription and, if it was the member's current one, clear their
   * active pointer and mark them inactive. Owner only.
   */
  async cancel(subId: string): Promise<SubscriptionRead> {
    const subscription = await subscriptionRepository.findById(
      toObjectId(subId, "Subscription not found", "SUBSCRIPTION_NOT_FOUND"),
    );
    if (!subscription) {
      throw new NotFoundError("Subscription not found", "SUBSCRIPTION_NOT_FOUND");
    }

    subscription.status = SUBSCRIPTION_STATUS.CANCELLED;
    await subscription.save();

    const user = await userRepository.findById(subscription.user_id);
    if (user && String(user.active_subscription_id) === String(subscription._id)) {
      user.active_subscription_id = null;
      user.gym_meta.membership_status = MEMBERSHIP_STATUS.INACTIVE;
      await user.save();
    }

    return toSubscriptionRead(subscription);
  },

  /** Shared status transition used by pause and resume. */
  async setStatus(subId: string, status: string): Promise<SubscriptionRead> {
    const subscription = await subscriptionRepository.findById(
      toObjectId(subId, "Subscription not found", "SUBSCRIPTION_NOT_FOUND"),
    );
    if (!subscription) {
      throw new NotFoundError("Subscription not found", "SUBSCRIPTION_NOT_FOUND");
    }

    subscription.status = status;
    subscription.updated_at = getUtcNow();
    await subscription.save();
    return toSubscriptionRead(subscription);
  },
};

/**
 * Attendance recording.
 *
 * Mirrors `server/app/services/checkin_service.py`.
 *
 * Attendance is always recorded by a trainer or the owner — members never
 * check themselves in. The quota is charged per *day*, not per entry: the
 * first check-in of a calendar day deducts one day, and any re-entry the same
 * day is admitted free. That is what makes a member who steps out for lunch
 * not pay twice.
 */
import { SUBSCRIPTION_STATUS } from "../config/constants.js";
import type {
  AttendanceHistoryItem,
  CheckInInput,
  CheckInResult,
  TodayCheckInItem,
} from "../dtos/checkin.dto.js";
import { ForbiddenError, NotFoundError } from "../errors/index.js";
import type { UserDoc } from "../models/User.js";
import { subscriptionRepository, userRepository } from "../repositories/index.js";
import {
  formatDisplayDate,
  getTodayStr,
  getUtcNow,
  toCalendarDateStr,
} from "../utils/date.js";
import { isValidObjectId } from "../utils/objectId.js";
import type { Types } from "mongoose";

export const checkinService = {
  /**
   * Record a member's attendance for today.
   *
   * Refuses, in order: an unknown member, no active plan, a plan whose
   * calendar window has closed, and an exhausted visit quota. The latter two
   * also write the terminal status back to the subscription, so the state is
   * corrected the moment it is observed rather than waiting for the nightly
   * job.
   */
  async markAttendance(
    payload: CheckInInput,
    markedById: Types.ObjectId,
  ): Promise<CheckInResult> {
    // 1. Identify the member by id or phone number.
    let member: UserDoc | null = null;
    if (payload.member_id) {
      if (!isValidObjectId(payload.member_id)) {
        throw new NotFoundError("Member ID format is invalid", "INVALID_MEMBER_ID");
      }
      member = await userRepository.findById(payload.member_id);
    } else if (payload.phone) {
      member = await userRepository.findByPhone(payload.phone);
    }

    if (!member) {
      throw new NotFoundError("Member not found", "MEMBER_NOT_FOUND");
    }

    // 2. They need a live subscription.
    const subscription = await subscriptionRepository.findActiveByUser(member._id);
    if (!subscription) {
      throw new ForbiddenError(
        `${member.full_name} does not have an active gym plan.`,
        "NO_ACTIVE_SUBSCRIPTION",
      );
    }

    // 3. The calendar window must still be open.
    const todayStr = getTodayStr();
    const expiresOn = toCalendarDateStr(subscription.expires_on) ?? todayStr;
    if (todayStr > expiresOn) {
      subscription.status = SUBSCRIPTION_STATUS.EXPIRED;
      await subscription.save();
      throw new ForbiddenError(
        `${member.full_name}'s plan expired on ${formatDisplayDate(expiresOn)}.`,
        "SUBSCRIPTION_EXPIRED",
      );
    }

    // 4. They must have visits left.
    if (subscription.days_remaining <= 0) {
      subscription.status = SUBSCRIPTION_STATUS.EXHAUSTED;
      await subscription.save();
      throw new ForbiddenError(
        `${member.full_name} has exhausted all ${subscription.allocated_days} allocated days.`,
        "QUOTA_EXHAUSTED",
      );
    }

    // 5. Charge a day only for the first entry of the day.
    const now = getUtcNow();
    const isFirstToday = !subscription.attendance_log.some(
      (entry) => entry.date === todayStr,
    );

    if (isFirstToday) {
      subscription.attendance_log.push({
        date: todayStr,
        check_in_time: now,
        check_out_time: null,
        marked_by: markedById,
      });
      subscription.days_used += 1;
      subscription.days_remaining -= 1;

      // Spending the last day closes the subscription immediately.
      if (subscription.days_remaining === 0) {
        subscription.status = SUBSCRIPTION_STATUS.EXHAUSTED;
      }

      await subscription.save();
    }
    // Re-entry on the same day: admitted, nothing deducted, nothing logged.

    return {
      member: {
        id: String(member._id),
        full_name: member.full_name,
        phone: member.phone,
        avatar_url: member.profile?.avatar_url ?? null,
      },
      check_in_time: now,
      days_remaining: subscription.days_remaining,
      allocated_days: subscription.allocated_days,
      is_first_today: isFirstToday,
    };
  },

  /** Everyone who attended today, most recent first. */
  async getTodayCheckIns(): Promise<TodayCheckInItem[]> {
    const todayStr = getTodayStr();
    const subscriptions = await subscriptionRepository.listWithAttendanceOn(todayStr);
    const members = await userRepository.findManyByIds(
      subscriptions.map((sub) => sub.user_id),
    );

    const results: TodayCheckInItem[] = [];
    for (const subscription of subscriptions) {
      const member = members.get(String(subscription.user_id));
      if (!member) continue;

      const todayEntry = subscription.attendance_log.find(
        (entry) => entry.date === todayStr,
      );
      if (!todayEntry) continue;

      results.push({
        member: {
          id: String(member._id),
          full_name: member.full_name,
          phone: member.phone,
          avatar_url: member.profile?.avatar_url ?? null,
        },
        check_in_time: todayEntry.check_in_time,
        days_remaining: subscription.days_remaining,
      });
    }

    results.sort(
      (a, b) => b.check_in_time.getTime() - a.check_in_time.getTime(),
    );
    return results;
  },

  /**
   * A member's full attendance history across every subscription they have
   * held, newest first.
   */
  async getMemberAttendance(memberId: string): Promise<AttendanceHistoryItem[]> {
    const subscriptions = await subscriptionRepository.listByUser(memberId);

    const entries = subscriptions.flatMap((sub) =>
      sub.attendance_log.map((entry) => ({
        date: entry.date,
        check_in_time: entry.check_in_time,
        check_out_time: entry.check_out_time ?? null,
        marked_by: String(entry.marked_by),
      })),
    );

    entries.sort((a, b) => b.check_in_time.getTime() - a.check_in_time.getTime());
    return entries;
  },
};

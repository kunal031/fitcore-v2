/**
 * Demo dataset seed.
 *
 * Mirrors `server/app/demo_data.py`. Creates a populated gym: plans (active
 * and archived), coupons, ten members, and for each an active subscription
 * with a back-dated payment and attendance history, so every screen has
 * realistic data to render.
 *
 * Requires `npm run seed` to have created the Admin and Trainer first.
 * Idempotent — safe to re-run.
 *
 *   npm run demo
 */
import type { Types } from "mongoose";

import {
  MEMBERSHIP_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  ROLES,
  SUBSCRIPTION_STATUS,
} from "../config/constants.js";
import { closeDatabaseConnection, connectToDatabase } from "../config/database.js";
import { Coupon, type CouponDoc } from "../models/Coupon.js";
import { Payment } from "../models/Payment.js";
import { Plan, type PlanDoc } from "../models/Plan.js";
import { Referral } from "../models/Referral.js";
import { Subscription, type AttendanceEntry } from "../models/Subscription.js";
import { User, type UserDoc } from "../models/User.js";
import { addDaysToDateStr, getUtcNow, parseDateStr, toDateStr } from "../utils/date.js";
import { logger } from "../utils/logger.js";
import { hashPassword } from "../utils/password.js";
import {
  ARCHIVED_PLANS,
  DEMO_COUPONS,
  DEMO_PASSWORD,
  DEMO_PLANS,
  DEMO_USERS,
  type DemoPlanFixture,
} from "./fixtures/demoFixtures.js";

const ADMIN_PHONE = "+919999999999";
const TRAINER_PHONE = "+918888888888";

/** Create a plan if missing, and force its active flag to the wanted state. */
async function ensurePlan(
  fixture: DemoPlanFixture,
  isActive: boolean,
): Promise<PlanDoc> {
  const existing = await Plan.findOne({ plan_name: fixture.plan_name }).exec();

  if (!existing) {
    return Plan.create({ ...fixture, is_active: isActive });
  }

  if (existing.is_active !== isActive) {
    existing.is_active = isActive;
    await existing.save();
  }
  return existing;
}

/** Seed the active catalogue and the archived plans. */
async function ensurePlans(): Promise<{
  activePlans: PlanDoc[];
  archivedPlans: PlanDoc[];
}> {
  const activePlans: PlanDoc[] = [];
  for (const fixture of DEMO_PLANS) {
    // eslint-disable-next-line no-await-in-loop
    activePlans.push(await ensurePlan(fixture, true));
  }

  const archivedPlans: PlanDoc[] = [];
  for (const fixture of ARCHIVED_PLANS) {
    // eslint-disable-next-line no-await-in-loop
    archivedPlans.push(await ensurePlan(fixture, false));
  }

  return { activePlans, archivedPlans };
}

/** Seed the demo coupons, dating each validity window from now. */
async function ensureCoupons(): Promise<CouponDoc[]> {
  const now = getUtcNow();
  const coupons: CouponDoc[] = [];

  for (const { days, ...fixture } of DEMO_COUPONS) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Coupon.findOne({ code: fixture.code }).exec();
    if (existing) {
      coupons.push(existing);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const created = await Coupon.create({
      ...fixture,
      valid_from: now,
      valid_until: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
      is_active: true,
    });
    coupons.push(created);
  }

  return coupons;
}

/** Create a demo member if their phone number is not already taken. */
async function ensureMember(
  fixture: (typeof DEMO_USERS)[number],
  trainerId: Types.ObjectId,
  hashedPassword: string,
): Promise<UserDoc> {
  const existing = await User.findOne({ phone: fixture.phone }).exec();
  if (existing) return existing;

  return User.create({
    phone: fixture.phone,
    hashed_password: hashedPassword,
    role: ROLES.MEMBER,
    full_name: fixture.fullName,
    email: fixture.email,
    profile: {
      gender: "other",
      address: { city: "Pune", state: "Maharashtra", pincode: "411045" },
    },
    gym_meta: {
      membership_status: MEMBERSHIP_STATUS.ACTIVE,
      assigned_trainer_id: trainerId,
    },
    my_referral_code: fixture.referralCode,
    loyalty_points: 100,
    is_active: true,
  });
}

/** Give a member their own referral record if they lack one. */
async function ensureReferral(member: UserDoc): Promise<void> {
  const existing = await Referral.findOne({ referrer_user_id: member._id }).exec();
  if (!existing) {
    await Referral.create({
      referrer_user_id: member._id,
      referral_code: member.my_referral_code,
    });
  }
}

/**
 * Build a back-dated attendance log.
 *
 * One entry per consecutive day from the start date, at a check-in hour that
 * varies by member so the "today" list is not a wall of identical times.
 */
function buildAttendanceLog(
  startsOn: string,
  daysUsed: number,
  markedBy: Types.ObjectId,
  memberIndex: number,
): AttendanceEntry[] {
  return Array.from({ length: daysUsed }, (_, dayOffset) => {
    const date = addDaysToDateStr(startsOn, dayOffset);
    const checkInTime = parseDateStr(date);
    checkInTime.setUTCHours(7 + (memberIndex % 3), 15, 0, 0);

    return {
      date,
      check_in_time: checkInTime,
      check_out_time: null,
      marked_by: markedBy,
    };
  });
}

/**
 * Give a member an active subscription with a matching payment record.
 *
 * Start dates are staggered by member index so the "expiring soon" and
 * attendance views show a spread rather than everyone on the same schedule.
 */
async function ensureSubscription(
  member: UserDoc,
  plan: PlanDoc,
  trainerId: Types.ObjectId,
  index: number,
): Promise<void> {
  const existing = await Subscription.findOne({
    user_id: member._id,
    plan_id: plan._id,
    status: SUBSCRIPTION_STATUS.ACTIVE,
  }).exec();
  if (existing) return;

  // Started 8+ days ago, so some attendance has already accrued.
  const startedOn = toDateStr(
    new Date(getUtcNow().getTime() - (8 + index) * 24 * 60 * 60 * 1000),
  );
  // Always leave at least one day unused, so check-in can still be demoed.
  const daysUsed = Math.min(3 + index, plan.allocated_days - 1);
  const expiresOn = addDaysToDateStr(startedOn, plan.calendar_days);
  const receiptNumber = `DEMO-${String(index + 1).padStart(2, "0")}-${String(plan._id)}`;

  let payment = await Payment.findOne({ receipt_number: receiptNumber }).exec();
  if (!payment) {
    payment = await Payment.create({
      user_id: member._id,
      plan_id: plan._id,
      receipt_number: receiptNumber,
      amount_paise: plan.price_paise,
      discount_paise: 0,
      final_amount_paise: plan.price_paise,
      payment_method: PAYMENT_METHOD.CASH,
      status: PAYMENT_STATUS.SUCCESS,
      note: "Demo payment record",
      recorded_by: trainerId,
    });
  }

  const subscription = await Subscription.create({
    user_id: member._id,
    plan_id: plan._id,
    payment_id: payment._id,
    plan_snapshot: {
      plan_name: plan.plan_name,
      price_paise: plan.price_paise,
      allocated_days: plan.allocated_days,
      calendar_days: plan.calendar_days,
      features: plan.features,
    },
    status: SUBSCRIPTION_STATUS.ACTIVE,
    allocated_days: plan.allocated_days,
    days_used: daysUsed,
    days_remaining: plan.allocated_days - daysUsed,
    starts_on: startedOn,
    expires_on: expiresOn,
    attendance_log: buildAttendanceLog(startedOn, daysUsed, trainerId, index),
  });

  member.active_subscription_id = subscription._id;
  member.gym_meta.membership_status = MEMBERSHIP_STATUS.ACTIVE;
  await member.save();
}

async function seedDemoData(): Promise<void> {
  logger.info("Connecting to MongoDB for demo data...");
  await connectToDatabase();

  try {
    const [admin, trainer] = await Promise.all([
      User.findOne({ phone: ADMIN_PHONE }).exec(),
      User.findOne({ phone: TRAINER_PHONE }).exec(),
    ]);

    if (!admin || !trainer) {
      throw new Error("Run `npm run seed` first to create the Admin and Trainer.");
    }

    const { activePlans, archivedPlans } = await ensurePlans();
    const coupons = await ensureCoupons();

    // Hash once: bcrypt is deliberately slow, and every demo member shares
    // the same development password.
    const hashedPassword = await hashPassword(DEMO_PASSWORD);

    for (const [index, fixture] of DEMO_USERS.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const member = await ensureMember(fixture, trainer._id, hashedPassword);
      // eslint-disable-next-line no-await-in-loop
      await ensureReferral(member);

      // Spread members across the catalogue so every plan has subscribers.
      const plan = activePlans[index % activePlans.length];
      if (plan) {
        // eslint-disable-next-line no-await-in-loop
        await ensureSubscription(member, plan, trainer._id, index);
      }
    }

    logger.info(
      `Demo data ready: ${activePlans.length} active plans, ${archivedPlans.length} archived plans, ${coupons.length} coupons, ${DEMO_USERS.length} members.`,
    );
  } finally {
    await closeDatabaseConnection();
  }
}

seedDemoData().catch((error: unknown) => {
  logger.error({ err: error }, "Demo data seeding failed");
  process.exit(1);
});

/**
 * Base data seed.
 *
 * Mirrors `server/app/seed.py`. Creates the three development accounts, the
 * starter plan catalogue and two sample coupons.
 *
 * Idempotent: every record is looked up before being created, so running this
 * repeatedly is safe and never duplicates or overwrites existing data.
 *
 *   npm run seed
 */
import {
  DISCOUNT_TYPE,
  MEMBERSHIP_STATUS,
  PLAN_CATEGORY,
  ROLES,
} from "../config/constants.js";
import { closeDatabaseConnection, connectToDatabase } from "../config/database.js";
import { Coupon } from "../models/Coupon.js";
import { Plan } from "../models/Plan.js";
import { Referral } from "../models/Referral.js";
import { User, type UserDoc } from "../models/User.js";
import { getUtcNow } from "../utils/date.js";
import { logger } from "../utils/logger.js";
import { hashPassword } from "../utils/password.js";

/** Add whole days to a timestamp. */
function daysFromNow(days: number): Date {
  return new Date(getUtcNow().getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Give a user a referral record, unless one already exists under either their
 * id or the code. Guards against the duplicate-key error that a partially
 * seeded database would otherwise produce.
 */
async function ensureReferral(user: UserDoc, referralCode: string): Promise<void> {
  const existing = await Referral.findOne({
    $or: [{ referrer_user_id: user._id }, { referral_code: referralCode }],
  }).exec();

  if (!existing) {
    await Referral.create({
      referrer_user_id: user._id,
      referral_code: referralCode,
    });
  }
}

async function seedDatabase(): Promise<void> {
  logger.info("Connecting to MongoDB for database seeding...");
  await connectToDatabase();

  // ── 1. Master Owner / Admin ──────────────────────────────────────────────
  const ownerPhone = "+919999999999";
  let owner = await User.findOne({ phone: ownerPhone }).exec();
  if (!owner) {
    owner = await User.create({
      phone: ownerPhone,
      hashed_password: await hashPassword("Owner@123"),
      role: ROLES.OWNER,
      full_name: "Master Admin (Owner)",
      email: "owner@fitcore.in",
      profile: {
        gender: "male",
        address: { city: "Mumbai", state: "Maharashtra", pincode: "400001" },
      },
      gym_meta: { membership_status: MEMBERSHIP_STATUS.ACTIVE },
      my_referral_code: "OWNER001",
      is_active: true,
    });
    logger.info(`Created Master Owner: ${owner.full_name} (${ownerPhone}) / Owner@123`);
  } else {
    logger.info(`Master Owner already exists (${ownerPhone}).`);
  }
  await ensureReferral(owner, "OWNER001");

  // ── 2. Sample Trainer ────────────────────────────────────────────────────
  const trainerPhone = "+918888888888";
  let trainer = await User.findOne({ phone: trainerPhone }).exec();
  if (!trainer) {
    trainer = await User.create({
      phone: trainerPhone,
      hashed_password: await hashPassword("Trainer@123"),
      role: ROLES.TRAINER,
      full_name: "Trainer Vikram",
      email: "vikram@fitcore.in",
      profile: {
        gender: "male",
        address: { city: "Pune", state: "Maharashtra", pincode: "411045" },
      },
      gym_meta: { membership_status: MEMBERSHIP_STATUS.ACTIVE },
      my_referral_code: "TRAINER01",
      is_active: true,
    });
    logger.info(
      `Created Sample Trainer: ${trainer.full_name} (${trainerPhone}) / Trainer@123`,
    );
  } else {
    logger.info(`Sample Trainer already exists (${trainerPhone}).`);
  }
  await ensureReferral(trainer, "TRAINER01");

  // ── 3. Sample Member ─────────────────────────────────────────────────────
  const memberPhone = "+917777777777";
  let member = await User.findOne({ phone: memberPhone }).exec();
  if (!member) {
    member = await User.create({
      phone: memberPhone,
      hashed_password: await hashPassword("Member@123"),
      role: ROLES.MEMBER,
      full_name: "Arjun Patil (Sample Member)",
      email: "arjun@example.com",
      profile: {
        gender: "male",
        blood_group: "B+",
        address: { city: "Pune", state: "Maharashtra", pincode: "411045" },
      },
      gym_meta: {
        membership_status: MEMBERSHIP_STATUS.INACTIVE,
        assigned_trainer_id: trainer._id,
      },
      my_referral_code: "ARJUN001",
      is_active: true,
    });
    logger.info(
      `Created Sample Member: ${member.full_name} (${memberPhone}) / Member@123`,
    );
  } else {
    logger.info(`Sample Member already exists (${memberPhone}).`);
  }
  await ensureReferral(member, "ARJUN001");

  // ── 4. Starter plan catalogue ────────────────────────────────────────────
  const defaultPlans = [
    {
      plan_name: "Silver Monthly",
      description: "Standard gym access with cardio and weight training.",
      category: PLAN_CATEGORY.BASIC,
      price_paise: 120000, // ₹1,200
      calendar_days: 30,
      allocated_days: 26,
      features: ["General Equipment Access", "Locker Room", "Cardio Zone"],
    },
    {
      plan_name: "Gold Monthly",
      description:
        "Premium access including steam bath and 1 trainer guidance session per week.",
      category: PLAN_CATEGORY.STANDARD,
      price_paise: 150000, // ₹1,500
      calendar_days: 30,
      allocated_days: 26,
      features: [
        "Full Equipment Access",
        "Steam Bath",
        "Weekly Trainer Guidance",
        "Locker Room",
      ],
    },
    {
      plan_name: "Platinum Annual",
      description:
        "Year-round unrestricted membership with nutrition consultation and personalized workout plan.",
      category: PLAN_CATEGORY.PREMIUM,
      price_paise: 1200000, // ₹12,000
      calendar_days: 365,
      allocated_days: 312,
      features: [
        "365 Days Access",
        "Personalized Workout Plan",
        "Diet & Nutrition Consultation",
        "All VIP Amenities",
      ],
    },
  ];

  for (const planData of defaultPlans) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Plan.findOne({ plan_name: planData.plan_name }).exec();
    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await Plan.create({ ...planData, is_active: true });
      logger.info(
        `Created Plan: ${planData.plan_name} (₹${Math.floor(planData.price_paise / 100)})`,
      );
    }
  }

  // ── 5. Sample coupons ────────────────────────────────────────────────────
  const now = getUtcNow();
  const defaultCoupons = [
    {
      code: "WELCOME10",
      name: "New Member Welcome Offer",
      description: "Get 10% discount on any monthly or annual gym plan.",
      discount_type: DISCOUNT_TYPE.PERCENTAGE,
      discount_value: 10,
      min_plan_price_paise: 100000,
      max_discount_paise: 20000, // capped at ₹200 off
      max_uses: 500,
      per_user_limit: 1,
      valid_from: now,
      valid_until: daysFromNow(90),
    },
    {
      code: "FESTIVE20",
      name: "Festive Season Flat Discount",
      description: "Flat ₹200 discount for the ongoing festival season.",
      discount_type: DISCOUNT_TYPE.FLAT_PAISE,
      discount_value: 20000, // flat ₹200 off
      min_plan_price_paise: 120000,
      max_uses: 200,
      per_user_limit: 1,
      valid_from: now,
      valid_until: daysFromNow(30),
    },
  ];

  for (const couponData of defaultCoupons) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Coupon.findOne({ code: couponData.code }).exec();
    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await Coupon.create({ ...couponData, is_active: true });
      logger.info(`Created Coupon: ${couponData.code}`);
    }
  }

  logger.info("Database seeding completed successfully.");
  await closeDatabaseConnection();
}

seedDatabase().catch((error: unknown) => {
  logger.error({ err: error }, "Seeding failed");
  process.exit(1);
});

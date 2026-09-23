/**
 * Demo fixture data.
 *
 * Separated from the seeding logic so the dataset can be adjusted without
 * touching the code that writes it. Mirrors the constants at the top of
 * `server/app/demo_data.py`.
 */
import { DISCOUNT_TYPE, PLAN_CATEGORY } from "../../config/constants.js";

export interface DemoPlanFixture {
  plan_name: string;
  description: string;
  category: string;
  price_paise: number;
  calendar_days: number;
  allocated_days: number;
  features: string[];
}

/** Plans that appear in the member catalogue. */
export const DEMO_PLANS: DemoPlanFixture[] = [
  {
    plan_name: "Demo Starter Monthly",
    description: "A focused monthly plan for members building a steady routine.",
    category: PLAN_CATEGORY.BASIC,
    price_paise: 100000,
    calendar_days: 30,
    allocated_days: 24,
    features: ["Gym floor access", "Cardio zone", "Locker room"],
  },
  {
    plan_name: "Demo Strength Monthly",
    description: "A balanced monthly plan for strength and conditioning work.",
    category: PLAN_CATEGORY.STANDARD,
    price_paise: 145000,
    calendar_days: 30,
    allocated_days: 26,
    features: ["Full equipment access", "Trainer guidance", "Locker room"],
  },
  {
    plan_name: "Demo Performance Quarterly",
    description: "A longer commitment with extra time to build performance.",
    category: PLAN_CATEGORY.STANDARD,
    price_paise: 390000,
    calendar_days: 90,
    allocated_days: 78,
    features: ["Full equipment access", "Progress review", "Steam room"],
  },
  {
    plan_name: "Demo Elite Half Year",
    description: "A six-month plan for consistent training and measurable progress.",
    category: PLAN_CATEGORY.PREMIUM,
    price_paise: 680000,
    calendar_days: 180,
    allocated_days: 156,
    features: ["All equipment access", "Monthly trainer review", "Nutrition check-in"],
  },
  {
    plan_name: "Demo Annual Unlimited",
    description: "Year-round access for members who want a full training lifestyle.",
    category: PLAN_CATEGORY.PREMIUM,
    price_paise: 1100000,
    calendar_days: 365,
    allocated_days: 312,
    features: ["Unlimited gym access", "Personal training review", "All amenities"],
  },
];

/**
 * Archived plans, kept inactive.
 *
 * They exist so the owner's plan screen has something to show in its archived
 * state, and so historical purchases can reference a plan no longer sold.
 */
export const ARCHIVED_PLANS: DemoPlanFixture[] = [
  {
    plan_name: "Demo Legacy Flex Plan",
    description: "Archived plan kept for previous purchase history.",
    category: PLAN_CATEGORY.BASIC,
    price_paise: 85000,
    calendar_days: 30,
    allocated_days: 20,
    features: ["Gym floor access"],
  },
  {
    plan_name: "Demo Legacy Gold Plan",
    description: "Archived plan kept for historical records.",
    category: PLAN_CATEGORY.STANDARD,
    price_paise: 125000,
    calendar_days: 30,
    allocated_days: 24,
    features: ["Full equipment access", "Locker room"],
  },
];

export interface DemoCouponFixture {
  code: string;
  name: string;
  description: string;
  discount_type: string;
  discount_value: number;
  min_plan_price_paise: number;
  max_discount_paise?: number;
  max_uses: number;
  per_user_limit: number;
  /** Validity in days from the moment of seeding. */
  days: number;
}

/**
 * Coupons covering both discount types and a range of minimum spends, so the
 * checkout flow can be exercised against each branch of the validation rules.
 */
export const DEMO_COUPONS: DemoCouponFixture[] = [
  {
    code: "DEMO10",
    name: "Demo Welcome 10",
    description: "Ten percent off for demo checkout testing.",
    discount_type: DISCOUNT_TYPE.PERCENTAGE,
    discount_value: 10,
    min_plan_price_paise: 0,
    max_discount_paise: 20000,
    max_uses: 100,
    per_user_limit: 1,
    days: 90,
  },
  {
    code: "DEMO200",
    name: "Demo Flat 200",
    description: "Two hundred rupees off for demo checkout testing.",
    discount_type: DISCOUNT_TYPE.FLAT_PAISE,
    discount_value: 20000,
    min_plan_price_paise: 100000,
    max_uses: 100,
    per_user_limit: 1,
    days: 90,
  },
  {
    code: "DEMO15",
    name: "Demo Fitness 15",
    description: "Fifteen percent off selected demo plans.",
    discount_type: DISCOUNT_TYPE.PERCENTAGE,
    discount_value: 15,
    min_plan_price_paise: 145000,
    max_discount_paise: 30000,
    max_uses: 75,
    per_user_limit: 1,
    days: 120,
  },
  {
    code: "DEMO500",
    name: "Demo Premium 500",
    description: "Five hundred rupees off premium demo plans.",
    discount_type: DISCOUNT_TYPE.FLAT_PAISE,
    discount_value: 50000,
    min_plan_price_paise: 390000,
    max_uses: 50,
    per_user_limit: 1,
    days: 120,
  },
  {
    code: "DEMO20",
    name: "Demo Anniversary 20",
    description: "Twenty percent off for anniversary flow testing.",
    discount_type: DISCOUNT_TYPE.PERCENTAGE,
    discount_value: 20,
    min_plan_price_paise: 680000,
    max_discount_paise: 100000,
    max_uses: 25,
    per_user_limit: 1,
    days: 180,
  },
];

export interface DemoUserFixture {
  fullName: string;
  phone: string;
  email: string;
  referralCode: string;
}

/** Ten demo members, +919100000001 .. +919100000010. */
export const DEMO_USERS: DemoUserFixture[] = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    fullName: `Demo Member ${n}`,
    phone: `+9191000000${n}`,
    email: `demo.member${n}@example.com`,
    referralCode: `DEMOUSER${n}`,
  };
});

/** Development-only password shared by every demo member. */
export const DEMO_PASSWORD = "Member@123";

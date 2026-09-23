/**
 * Fitness plan — the sellable product.
 *
 * A plan has two independent limits: `calendar_days` is how long the
 * subscription stays valid, `allocated_days` is how many gym visits it grants.
 * A member can exhaust their visits before the window closes, or vice versa.
 */
import { Schema, model, type HydratedDocument } from "mongoose";

import { COLLECTIONS, PLAN_CATEGORY } from "../config/constants.js";

export interface IPlan {
  plan_name: string;
  description: string | null;
  category: string;
  /** Price in paise. 150000 = ₹1,500.00. */
  price_paise: number;
  /** Validity window in calendar days. */
  calendar_days: number;
  /** Number of gym visits the plan grants. */
  allocated_days: number;
  features: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type PlanDoc = HydratedDocument<IPlan>;

const planSchema = new Schema<IPlan>(
  {
    plan_name: { type: String, required: true },
    description: { type: String, default: null },
    category: { type: String, default: PLAN_CATEGORY.STANDARD },
    price_paise: { type: Number, required: true },
    calendar_days: { type: Number, required: true },
    allocated_days: { type: Number, required: true },
    features: { type: [String], default: () => [] },
    is_active: { type: Boolean, default: true, index: true },
  },
  {
    collection: COLLECTIONS.PLANS,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false,
  },
);

export const Plan = model<IPlan>("Plan", planSchema);

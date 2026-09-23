/**
 * Plan request/response schemas.
 *
 * Mirrors `server/app/schemas/plan.py`.
 */
import { z } from "zod";

import { PLAN_CATEGORY } from "../config/constants.js";

export const planCreateSchema = z.object({
  plan_name: z.string().min(2).max(100),
  description: z.string().nullish(),
  category: z.string().default(PLAN_CATEGORY.STANDARD),
  /** Price in paise, e.g. 150000 = ₹1,500.00. */
  price_paise: z.number().int().positive(),
  /** Validity window in calendar days. */
  calendar_days: z.number().int().positive(),
  /** Gym visits permitted. */
  allocated_days: z.number().int().positive(),
  features: z.array(z.string()).default([]),
});
export type PlanCreateInput = z.infer<typeof planCreateSchema>;

export const planUpdateSchema = z.object({
  plan_name: z.string().min(2).max(100).nullish(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  price_paise: z.number().int().positive().nullish(),
  calendar_days: z.number().int().positive().nullish(),
  allocated_days: z.number().int().positive().nullish(),
  features: z.array(z.string()).nullish(),
  is_active: z.boolean().nullish(),
});
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

// ── Response shape ─────────────────────────────────────────────────────────

export interface PlanRead {
  id: string;
  plan_name: string;
  description: string | null;
  category: string;
  price_paise: number;
  calendar_days: number;
  allocated_days: number;
  features: string[];
  is_active: boolean;
  created_at: Date;
}

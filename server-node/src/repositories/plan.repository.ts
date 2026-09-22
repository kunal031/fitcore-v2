/**
 * Plan queries against the `fitness_plans` collection.
 */
import type { Types } from "mongoose";

import { Plan, type IPlan, type PlanDoc } from "../models/Plan.js";

export const planRepository = {
  findById(id: Types.ObjectId | string): Promise<PlanDoc | null> {
    return Plan.findById(id).exec();
  },

  /** Member-facing catalogue: active plans, cheapest first. */
  listActive(): Promise<PlanDoc[]> {
    return Plan.find({ is_active: true }).sort({ price_paise: 1 }).exec();
  },

  /** Owner-facing list, including archived plans. */
  listAll(): Promise<PlanDoc[]> {
    return Plan.find().sort({ created_at: -1 }).exec();
  },

  /** Guards against two active plans sharing a name. */
  findActiveByName(planName: string): Promise<PlanDoc | null> {
    return Plan.findOne({ plan_name: planName, is_active: true }).exec();
  },

  create(data: Partial<IPlan>): Promise<PlanDoc> {
    return Plan.create(data);
  },

  async findManyByIds(
    ids: (Types.ObjectId | string)[],
  ): Promise<Map<string, PlanDoc>> {
    if (ids.length === 0) return new Map();
    const unique = [...new Set(ids.map(String))];
    const plans = await Plan.find({ _id: { $in: unique } }).exec();
    return new Map(plans.map((plan) => [String(plan._id), plan]));
  },
};

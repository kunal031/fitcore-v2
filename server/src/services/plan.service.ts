/**
 * Fitness plan catalogue management.
 *
 * Mirrors `server/app/services/plan_service.py`.
 *
 * Plans are never deleted, only deactivated: existing subscriptions reference
 * their plan, and each one snapshots the plan's terms at purchase time, so
 * editing or archiving a plan never changes what a member already bought.
 */
import type { PlanCreateInput, PlanRead, PlanUpdateInput } from "../dtos/plan.dto.js";
import { ConflictError, NotFoundError } from "../errors/index.js";
import { planRepository } from "../repositories/index.js";
import { toObjectId } from "../utils/objectId.js";
import { toPlanRead } from "./mappers/index.js";

export const planService = {
  /** Member-facing catalogue: active plans only, cheapest first. */
  async listActive(): Promise<PlanRead[]> {
    const plans = await planRepository.listActive();
    return plans.map(toPlanRead);
  },

  /** Owner-facing list including archived plans, newest first. */
  async listAll(): Promise<PlanRead[]> {
    const plans = await planRepository.listAll();
    return plans.map(toPlanRead);
  },

  async getById(planId: string): Promise<PlanRead> {
    const plan = await planRepository.findById(
      toObjectId(planId, "Plan not found", "PLAN_NOT_FOUND"),
    );
    if (!plan) {
      throw new NotFoundError("Plan not found", "PLAN_NOT_FOUND");
    }
    return toPlanRead(plan);
  },

  /**
   * Create a plan.
   *
   * The name must be unique among *active* plans only, so a name freed by
   * archiving an old plan can be reused.
   */
  async create(payload: PlanCreateInput): Promise<PlanRead> {
    if (await planRepository.findActiveByName(payload.plan_name)) {
      throw new ConflictError(
        `A plan named '${payload.plan_name}' already exists.`,
        "PLAN_NAME_EXISTS",
      );
    }

    const plan = await planRepository.create({
      plan_name: payload.plan_name,
      description: payload.description ?? null,
      category: payload.category,
      price_paise: payload.price_paise,
      calendar_days: payload.calendar_days,
      allocated_days: payload.allocated_days,
      features: payload.features,
      is_active: true,
    });

    return toPlanRead(plan);
  },

  /** Apply a partial update. Only keys present in the payload are written. */
  async update(planId: string, payload: PlanUpdateInput): Promise<PlanRead> {
    const plan = await planRepository.findById(
      toObjectId(planId, "Plan not found", "PLAN_NOT_FOUND"),
    );
    if (!plan) {
      throw new NotFoundError("Plan not found", "PLAN_NOT_FOUND");
    }

    if (payload.plan_name != null) plan.plan_name = payload.plan_name;
    if (payload.description != null) plan.description = payload.description;
    if (payload.category != null) plan.category = payload.category;
    if (payload.price_paise != null) plan.price_paise = payload.price_paise;
    if (payload.calendar_days != null) plan.calendar_days = payload.calendar_days;
    if (payload.allocated_days != null) plan.allocated_days = payload.allocated_days;
    if (payload.features != null) plan.features = payload.features;
    if (payload.is_active != null) plan.is_active = payload.is_active;

    await plan.save();
    return toPlanRead(plan);
  },

  /**
   * Archive or restore a plan.
   *
   * Deactivating removes it from the member catalogue and from new checkouts;
   * subscriptions already sold against it are unaffected.
   */
  async setActive(planId: string, isActive: boolean): Promise<PlanRead> {
    const plan = await planRepository.findById(
      toObjectId(planId, "Plan not found", "PLAN_NOT_FOUND"),
    );
    if (!plan) {
      throw new NotFoundError("Plan not found", "PLAN_NOT_FOUND");
    }

    plan.is_active = isActive;
    await plan.save();
    return toPlanRead(plan);
  },
};

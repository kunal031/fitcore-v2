/** Document -> response mapping for plans. */
import type { PlanDoc } from "../../models/Plan.js";
import type { PlanRead } from "../../dtos/plan.dto.js";

export function toPlanRead(plan: PlanDoc): PlanRead {
  return {
    id: String(plan._id),
    plan_name: plan.plan_name,
    description: plan.description ?? null,
    category: plan.category,
    price_paise: plan.price_paise,
    calendar_days: plan.calendar_days,
    allocated_days: plan.allocated_days,
    features: plan.features ?? [],
    is_active: plan.is_active,
    created_at: plan.created_at,
  };
}

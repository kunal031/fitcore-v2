/**
 * Subscription query/response schemas.
 *
 * Mirrors `server/app/schemas/subscription.py`. Subscriptions are never
 * created through a request body — they are a side effect of a successful
 * payment.
 */
import { z } from "zod";

/** `GET /subscriptions/expiring?days=7` — bounded 1..30. */
export const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});
export type ExpiringQuery = z.infer<typeof expiringQuerySchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface AttendanceEntryRead {
  date: string;
  check_in_time: Date;
  check_out_time: Date | null;
  marked_by: string;
}

export interface PlanSnapshotRead {
  plan_name: string;
  price_paise: number;
  allocated_days: number;
  calendar_days: number;
  features: string[];
}

export interface SubscriptionRead {
  id: string;
  user_id: string;
  plan_id: string;
  payment_id: string;
  plan_snapshot: PlanSnapshotRead;
  status: string;
  allocated_days: number;
  days_used: number;
  /** Visit quota left. */
  days_remaining: number;
  starts_on: string;
  expires_on: string;
  /** Calendar days left before expiry — distinct from the visit quota. */
  days_until_expiry: number;
  attendance_log: AttendanceEntryRead[];
  created_at: Date;
}

export interface ExpiringSubscriptionItem {
  subscription_id: string;
  member_id: string;
  member_name: string;
  member_phone: string;
  plan_name: string;
  days_remaining: number;
  expires_on: string;
  days_until_expiry: number;
}

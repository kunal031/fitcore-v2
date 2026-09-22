/**
 * Subscription — a member's purchased plan, and the attendance log against it.
 *
 * The plan is snapshotted at purchase time so that later edits to the plan
 * (price, features, day counts) never retroactively change what a member
 * bought.
 *
 * Two counters run independently:
 *   - `expires_on`     the calendar window closes.
 *   - `days_remaining` the visit quota runs out ("exhausted").
 */
import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { COLLECTIONS, SUBSCRIPTION_STATUS } from "../config/constants.js";

export interface AttendanceEntry {
  /** Calendar date as `YYYY-MM-DD`; one entry per day the member attended. */
  date: string;
  check_in_time: Date;
  check_out_time: Date | null;
  /** The trainer or owner who recorded this entry. Members never self-check-in. */
  marked_by: Types.ObjectId;
}

export interface PlanSnapshot {
  plan_name: string;
  price_paise: number;
  allocated_days: number;
  calendar_days: number;
  features: string[];
}

export interface ISubscription {
  user_id: Types.ObjectId;
  plan_id: Types.ObjectId;
  payment_id: Types.ObjectId;
  plan_snapshot: PlanSnapshot;
  status: string;
  allocated_days: number;
  days_used: number;
  days_remaining: number;
  /** Calendar dates as `YYYY-MM-DD`. */
  starts_on: string;
  expires_on: string;
  attendance_log: AttendanceEntry[];
  created_at: Date;
  updated_at: Date;
}

export type SubscriptionDoc = HydratedDocument<ISubscription>;

const attendanceEntrySchema = new Schema<AttendanceEntry>(
  {
    date: { type: String, required: true },
    check_in_time: { type: Date, default: () => new Date() },
    check_out_time: { type: Date, default: null },
    marked_by: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const planSnapshotSchema = new Schema<PlanSnapshot>(
  {
    plan_name: { type: String, required: true },
    price_paise: { type: Number, required: true },
    allocated_days: { type: Number, required: true },
    calendar_days: { type: Number, required: true },
    features: { type: [String], default: () => [] },
  },
  { _id: false },
);

const subscriptionSchema = new Schema<ISubscription>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, index: true },
    plan_id: { type: Schema.Types.ObjectId, required: true },
    payment_id: { type: Schema.Types.ObjectId, required: true },
    plan_snapshot: { type: planSnapshotSchema, required: true },
    status: { type: String, default: SUBSCRIPTION_STATUS.ACTIVE, index: true },
    allocated_days: { type: Number, required: true },
    days_used: { type: Number, default: 0 },
    days_remaining: { type: Number, required: true },
    starts_on: { type: String, required: true },
    expires_on: { type: String, required: true, index: true },
    attendance_log: { type: [attendanceEntrySchema], default: () => [] },
  },
  {
    collection: COLLECTIONS.SUBSCRIPTIONS,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false,
  },
);

// The hot path: "find this member's active subscription".
subscriptionSchema.index({ user_id: 1, status: 1 });
// Expiry sweeps and the "expiring soon" dashboard widget.
subscriptionSchema.index({ status: 1, expires_on: 1 });
// "Who checked in today" scans by the nested attendance date.
subscriptionSchema.index({ "attendance_log.date": 1 });

export const Subscription = model<ISubscription>("Subscription", subscriptionSchema);

/**
 * Check-in request/response schemas.
 *
 * Mirrors `server/app/schemas/checkin.py`. Attendance is recorded by a trainer
 * or the owner; members never check themselves in.
 */
import { z } from "zod";

import { lenientPhoneSchema, objectIdSchema } from "./common.dto.js";

/** A member is identified by id or by phone number; at least one is required. */
export const checkInSchema = z
  .object({
    member_id: objectIdSchema.nullish(),
    phone: lenientPhoneSchema.nullish(),
  })
  .refine(
    (value) => Boolean(value.member_id || value.phone),
    "Provide either a member_id or a phone number.",
  );
export type CheckInInput = z.infer<typeof checkInSchema>;

/** `GET /checkin/history?member_id=...` */
export const checkInHistoryQuerySchema = z.object({
  member_id: objectIdSchema,
});
export type CheckInHistoryQuery = z.infer<typeof checkInHistoryQuerySchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface CheckInMemberSummary {
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
}

export interface CheckInResult {
  member: CheckInMemberSummary;
  check_in_time: Date;
  days_remaining: number;
  allocated_days: number;
  /** False when the member was already marked present earlier today. */
  is_first_today: boolean;
}

export interface TodayCheckInItem {
  member: CheckInMemberSummary;
  check_in_time: Date;
  days_remaining: number;
}

export interface AttendanceHistoryItem {
  date: string;
  check_in_time: Date;
  check_out_time: Date | null;
  marked_by: string;
}

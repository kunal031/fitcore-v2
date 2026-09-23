/** Attendance HTTP handlers. Trainer or owner only. */
import type { Request, Response } from "express";

import type { CheckInHistoryQuery, CheckInInput } from "../dtos/checkin.dto.js";
import { asyncHandler, currentUser } from "../middleware/index.js";
import { checkinService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const checkinController = {
  /**
   * POST /checkin
   *
   * The message distinguishes a first entry, which spends a day and reports
   * the remaining balance, from a same-day re-entry, which spends nothing.
   */
  markAttendance: asyncHandler(async (req: Request, res: Response) => {
    const data = await checkinService.markAttendance(
      req.body as CheckInInput,
      currentUser(req)._id,
    );

    const message = data.is_first_today
      ? `✅ Welcome, ${data.member.full_name}! ${data.days_remaining} days remaining.`
      : `✅ Welcome back, ${data.member.full_name}! (Re-entry today)`;

    res.json(success(data, message));
  }),

  /** GET /checkin/today */
  getTodayCheckIns: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await checkinService.getTodayCheckIns()));
  }),

  /** GET /checkin/history?member_id=... */
  getMemberHistory: asyncHandler(async (req: Request, res: Response) => {
    const { member_id } = req.query as unknown as CheckInHistoryQuery;
    res.json(success(await checkinService.getMemberAttendance(member_id)));
  }),
};

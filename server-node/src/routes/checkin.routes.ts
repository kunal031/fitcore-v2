/**
 * `/api/v1/checkin`
 *
 * Attendance is staff-only throughout: a trainer or the owner records it, and
 * members have no route to check themselves in.
 */
import { Router } from "express";

import { checkinController } from "../controllers/index.js";
import {
  checkInHistoryQuerySchema,
  checkInSchema,
} from "../dtos/checkin.dto.js";
import { requireAuth, requireTrainerOrOwner, validate } from "../middleware/index.js";

export const checkinRoutes = Router();

checkinRoutes.use(requireAuth, requireTrainerOrOwner);

/** Records today's attendance, spending one day of the member's quota. */
checkinRoutes.post("", validate({ body: checkInSchema }), checkinController.markAttendance);

checkinRoutes.get("/today", checkinController.getTodayCheckIns);

checkinRoutes.get(
  "/history",
  validate({ query: checkInHistoryQuerySchema }),
  checkinController.getMemberHistory,
);

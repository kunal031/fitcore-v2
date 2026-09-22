/**
 * `/api/v1/coupons`
 *
 * `/validate/:code` is declared before `/:couponId`, so "validate" is not read
 * as a coupon id. Validation is the one route members may call.
 *
 * Listing is readable by staff — a trainer at the desk needs to tell a member
 * which offers are running. Creating, editing and deactivating remain
 * owner-only, so a trainer can see the catalogue but not change it.
 */
import { Router } from "express";

import { couponController } from "../controllers/index.js";
import { idParamSchema } from "../dtos/common.dto.js";
import {
  couponCreateSchema,
  couponUpdateSchema,
  validateCouponParamsSchema,
  validateCouponQuerySchema,
} from "../dtos/coupon.dto.js";
import {
  requireAuth,
  requireOwner,
  requireTrainerOrOwner,
  validate,
} from "../middleware/index.js";

export const couponRoutes = Router();

couponRoutes.use(requireAuth);

const couponIdParams = idParamSchema("couponId");

// ── Member-accessible ──────────────────────────────────────────────────────
// Literal prefix — must precede `/:couponId`.
couponRoutes.get(
  "/validate/:code",
  validate({ params: validateCouponParamsSchema, query: validateCouponQuerySchema }),
  couponController.validate,
);

// ── Staff-readable ─────────────────────────────────────────────────────────
// Read-only for trainers; every write below stays owner-only.
couponRoutes.get("", requireTrainerOrOwner, couponController.listAll);

// ── Owner-only management ──────────────────────────────────────────────────

couponRoutes.post(
  "",
  requireOwner,
  validate({ body: couponCreateSchema }),
  couponController.create,
);

couponRoutes.get(
  "/:couponId",
  requireOwner,
  validate({ params: couponIdParams }),
  couponController.getById,
);

couponRoutes.patch(
  "/:couponId",
  requireOwner,
  validate({ params: couponIdParams, body: couponUpdateSchema }),
  couponController.update,
);

couponRoutes.patch(
  "/:couponId/deactivate",
  requireOwner,
  validate({ params: couponIdParams }),
  couponController.deactivate,
);

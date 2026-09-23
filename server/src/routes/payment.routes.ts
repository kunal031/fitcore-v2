/**
 * `/api/v1/payments`
 *
 * `/me` is declared before the listing route so it is never treated as a
 * parameter. Members drive the gateway flow; staff record counter payments;
 * the owner sees everything.
 */
import { Router } from "express";

import { paymentController } from "../controllers/index.js";
import {
  initiatePaymentSchema,
  manualPaymentSchema,
  verifyPaymentSchema,
} from "../dtos/payment.dto.js";
import {
  requireAuth,
  requireMember,
  requireOwner,
  requireTrainerOrOwner,
  validate,
} from "../middleware/index.js";

export const paymentRoutes = Router();

paymentRoutes.use(requireAuth);

// ── Member checkout ────────────────────────────────────────────────────────
paymentRoutes.post(
  "/initiate",
  requireMember,
  validate({ body: initiatePaymentSchema }),
  paymentController.initiate,
);

paymentRoutes.post(
  "/verify",
  requireMember,
  validate({ body: verifyPaymentSchema }),
  paymentController.verify,
);

paymentRoutes.get("/me", requireMember, paymentController.getMyPayments);

// ── Staff ──────────────────────────────────────────────────────────────────
paymentRoutes.post(
  "/manual",
  requireTrainerOrOwner,
  validate({ body: manualPaymentSchema }),
  paymentController.recordManual,
);

paymentRoutes.get("", requireOwner, paymentController.listAll);

/**
 * `/api/v1/subscriptions`
 *
 * `/me`, `/me/history` and `/expiring` are all declared before `/:subId`, so
 * none of them is mistaken for a subscription id.
 */
import { Router } from "express";

import { subscriptionController } from "../controllers/index.js";
import { idParamSchema } from "../dtos/common.dto.js";
import { expiringQuerySchema } from "../dtos/subscription.dto.js";
import {
  requireAuth,
  requireMember,
  requireOwner,
  requireTrainerOrOwner,
  validate,
} from "../middleware/index.js";

export const subscriptionRoutes = Router();

subscriptionRoutes.use(requireAuth);

const subIdParams = idParamSchema("subId");

// ── Member self-service ────────────────────────────────────────────────────
subscriptionRoutes.get("/me", requireMember, subscriptionController.getMyActive);

subscriptionRoutes.get(
  "/me/history",
  requireMember,
  subscriptionController.getMyHistory,
);

// ── Staff ──────────────────────────────────────────────────────────────────
// Literal path — must precede `/:subId`.
subscriptionRoutes.get(
  "/expiring",
  requireTrainerOrOwner,
  validate({ query: expiringQuerySchema }),
  subscriptionController.getExpiring,
);

subscriptionRoutes.get(
  "/:subId",
  requireTrainerOrOwner,
  validate({ params: subIdParams }),
  subscriptionController.getById,
);

// ── Owner-only lifecycle controls ──────────────────────────────────────────
subscriptionRoutes.post(
  "/:subId/pause",
  requireOwner,
  validate({ params: subIdParams }),
  subscriptionController.pause,
);

subscriptionRoutes.post(
  "/:subId/resume",
  requireOwner,
  validate({ params: subIdParams }),
  subscriptionController.resume,
);

subscriptionRoutes.post(
  "/:subId/cancel",
  requireOwner,
  validate({ params: subIdParams }),
  subscriptionController.cancel,
);

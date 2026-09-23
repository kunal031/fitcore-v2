/**
 * `/api/v1/plans`
 *
 * `/all` is declared before `/:planId`; otherwise the owner's archive listing
 * would be matched as a lookup for a plan with the id "all".
 */
import { Router } from "express";

import { planController } from "../controllers/index.js";
import { idParamSchema } from "../dtos/common.dto.js";
import { planCreateSchema, planUpdateSchema } from "../dtos/plan.dto.js";
import { requireAuth, requireOwner, validate } from "../middleware/index.js";

export const planRoutes = Router();

planRoutes.use(requireAuth);

const planIdParams = idParamSchema("planId");

// ── Catalogue ──────────────────────────────────────────────────────────────
planRoutes.get("", planController.listActive);

// Literal path — must precede `/:planId`.
planRoutes.get("/all", requireOwner, planController.listAll);

planRoutes.post(
  "",
  requireOwner,
  validate({ body: planCreateSchema }),
  planController.create,
);

// ── Per-plan routes ────────────────────────────────────────────────────────
planRoutes.get(
  "/:planId",
  validate({ params: planIdParams }),
  planController.getById,
);

planRoutes.patch(
  "/:planId",
  requireOwner,
  validate({ params: planIdParams, body: planUpdateSchema }),
  planController.update,
);

planRoutes.patch(
  "/:planId/activate",
  requireOwner,
  validate({ params: planIdParams }),
  planController.activate,
);

planRoutes.patch(
  "/:planId/deactivate",
  requireOwner,
  validate({ params: planIdParams }),
  planController.deactivate,
);

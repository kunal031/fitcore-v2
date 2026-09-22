/**
 * `/api/v1/users`
 *
 * Route order matters: `/trainers` is declared before `/:userId`, otherwise
 * Express would match the literal path as an id and the trainer list would
 * 404.
 */
import { Router } from "express";

import { userController } from "../controllers/index.js";
import { idParamSchema } from "../dtos/common.dto.js";
import {
  assignTrainerSchema,
  listUsersQuerySchema,
  userCreateManualSchema,
  userProfileUpdateSchema,
  userStatusUpdateSchema,
} from "../dtos/user.dto.js";
import {
  requireAuth,
  requireOwner,
  requireTrainerOrOwner,
  validate,
} from "../middleware/index.js";

export const userRoutes = Router();

// Everything below requires a signed-in user.
userRoutes.use(requireAuth);

const userIdParams = idParamSchema("userId");

// ── Self-service ───────────────────────────────────────────────────────────
userRoutes.get("/me", userController.getMyProfile);

userRoutes.patch(
  "/me",
  validate({ body: userProfileUpdateSchema }),
  userController.updateMyProfile,
);

// ── Staff listings ─────────────────────────────────────────────────────────
userRoutes.get(
  "",
  requireTrainerOrOwner,
  validate({ query: listUsersQuerySchema }),
  userController.listUsers,
);

userRoutes.post(
  "",
  requireOwner,
  validate({ body: userCreateManualSchema }),
  userController.createUser,
);

// Literal path — must precede `/:userId`.
userRoutes.get("/trainers", requireOwner, userController.listTrainers);

// ── Per-user routes ────────────────────────────────────────────────────────
userRoutes.get(
  "/:userId",
  requireTrainerOrOwner,
  validate({ params: userIdParams }),
  userController.getUserById,
);

userRoutes.patch(
  "/:userId/status",
  requireOwner,
  validate({ params: userIdParams, body: userStatusUpdateSchema }),
  userController.updateUserStatus,
);

userRoutes.post(
  "/:userId/assign-trainer",
  requireOwner,
  validate({ params: userIdParams, body: assignTrainerSchema }),
  userController.assignTrainer,
);

// Any signed-in user; the controller enforces that a member sees only their own.
userRoutes.get(
  "/:userId/qr",
  validate({ params: userIdParams }),
  userController.getMemberQr,
);

/** User and staff HTTP handlers. */
import type { Request, Response } from "express";

import { ROLES } from "../config/constants.js";
import type {
  AssignTrainerInput,
  ListUsersQuery,
  UserCreateManualInput,
  UserProfileUpdateInput,
  UserStatusUpdateInput,
} from "../dtos/user.dto.js";
import { ForbiddenError } from "../errors/index.js";
import { asyncHandler, currentUser } from "../middleware/index.js";
import { userService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const userController = {
  /** GET /users/me — includes the assigned trainer's name. */
  getMyProfile: asyncHandler(async (req: Request, res: Response) => {
    const data = await userService.toUserReadWithTrainer(currentUser(req));
    res.json(success(data));
  }),

  /** PATCH /users/me — phone is not updatable; email only if not already set. */
  updateMyProfile: asyncHandler(async (req: Request, res: Response) => {
    const data = await userService.updateProfile(
      String(currentUser(req)._id),
      req.body as UserProfileUpdateInput,
    );
    res.json(success(data, "Profile updated successfully."));
  }),

  /** GET /users — paginated staff-facing member list. */
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const data = await userService.listUsers(req.query as unknown as ListUsersQuery);
    res.json(success(data));
  }),

  /** POST /users — 201. Owner only. */
  createUser: asyncHandler(async (req: Request, res: Response) => {
    const data = await userService.createUserManual(
      req.body as UserCreateManualInput,
    );
    res.status(201).json(success(data, "User created successfully."));
  }),

  /** GET /users/trainers — must be registered before GET /users/:userId. */
  listTrainers: asyncHandler(async (_req: Request, res: Response) => {
    const data = await userService.listTrainers();
    res.json(success(data));
  }),

  /** GET /users/:userId */
  getUserById: asyncHandler(async (req: Request, res: Response) => {
    const data = await userService.getById(req.params["userId"] as string);
    res.json(success(data));
  }),

  /** PATCH /users/:userId/status — Owner only. */
  updateUserStatus: asyncHandler(async (req: Request, res: Response) => {
    const data = await userService.updateStatus(
      req.params["userId"] as string,
      req.body as UserStatusUpdateInput,
    );
    res.json(success(data, "User status updated successfully."));
  }),

  /** POST /users/:userId/assign-trainer — Owner only. */
  assignTrainer: asyncHandler(async (req: Request, res: Response) => {
    const { trainer_id } = req.body as AssignTrainerInput;
    const data = await userService.assignTrainer(
      req.params["userId"] as string,
      trainer_id,
    );
    res.json(success(data, "Trainer assigned successfully."));
  }),

  /**
   * GET /users/:userId/qr
   *
   * A member may only fetch their own QR payload; staff may fetch anyone's.
   */
  getMemberQr: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    const userId = req.params["userId"] as string;

    if (user.role === ROLES.MEMBER && String(user._id) !== userId) {
      throw new ForbiddenError("Access denied.");
    }

    res.json(
      success({
        member_id: userId,
        qr_data: `fitcore:member:${userId}`,
      }),
    );
  }),
};

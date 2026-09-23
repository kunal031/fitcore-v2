/** Settings HTTP handlers. */
import type { Request, Response } from "express";

import type { SettingsUpdateInput } from "../dtos/setting.dto.js";
import { asyncHandler } from "../middleware/index.js";
import { settingService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const settingController = {
  /** GET /settings — current gym-wide settings. Owner only. */
  getSettings: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await settingService.getSettings()));
  }),

  /** PATCH /settings — update one or more settings. Owner only. */
  updateSettings: asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as SettingsUpdateInput;
    res.json(
      success(await settingService.updateSettings(payload), "Settings updated."),
    );
  }),
};

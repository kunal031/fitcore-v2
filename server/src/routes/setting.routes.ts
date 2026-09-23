/**
 * `/api/v1/settings`
 *
 * Owner only, both read and write. The trainer-visibility setting names the
 * trainers granted wider access, so exposing it to trainers would tell each
 * one which colleagues were singled out. Trainers get the resolved effect of
 * the policy on their own member list instead, never the policy itself.
 */
import { Router } from "express";

import { settingController } from "../controllers/index.js";
import { settingsUpdateSchema } from "../dtos/setting.dto.js";
import { requireAuth, requireOwner, validate } from "../middleware/index.js";

export const settingRoutes = Router();

settingRoutes.use(requireAuth, requireOwner);

settingRoutes.get("", settingController.getSettings);

settingRoutes.patch(
  "",
  validate({ body: settingsUpdateSchema }),
  settingController.updateSettings,
);

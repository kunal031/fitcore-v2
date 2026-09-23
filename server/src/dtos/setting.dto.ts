/**
 * Settings request/response schemas.
 *
 * The stored form is key-value (see `models/Setting.ts`), but the wire form is
 * a flat object — the client has no reason to know how it is stored, and a
 * flat shape keeps the PATCH body obvious.
 */
import { z } from "zod";

import { TRAINER_VISIBILITY } from "../config/constants.js";
import { objectIdSchema } from "./common.dto.js";

/**
 * Partial update: only the keys present are written, so a form editing one
 * control cannot blank out the other.
 */
export const settingsUpdateSchema = z
  .object({
    trainer_visibility: z
      .enum([TRAINER_VISIBILITY.ASSIGNED, TRAINER_VISIBILITY.ALL])
      .optional(),
    trainer_visibility_overrides: z.array(objectIdSchema).optional(),
  })
  // An empty body is almost certainly a mistake on the caller's side, and
  // silently succeeding would look like the write landed.
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one setting to update",
  });
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface SettingsRead {
  /** Which members a trainer sees by default. */
  trainer_visibility: string;
  /** Trainers exempted from the above — they see every member. */
  trainer_visibility_overrides: string[];
}

/**
 * Gym-wide setting — one document per key.
 *
 * Key-value rather than a single document with named fields: more settings are
 * planned, and this shape makes each new one a write rather than a migration.
 * `value` is deliberately untyped at the schema level; each key's shape is
 * enforced by the DTO that reads it.
 */
import { Schema, model, type HydratedDocument } from "mongoose";

import { COLLECTIONS } from "../config/constants.js";

export interface ISetting {
  key: string;
  value: unknown;
  updated_at: Date;
}

export type SettingDoc = HydratedDocument<ISetting>;

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    // Mixed, because each key stores its own shape — a string for
    // trainer_visibility, an array of ids for the overrides.
    value: { type: Schema.Types.Mixed, default: null },
  },
  {
    collection: COLLECTIONS.SETTINGS,
    // No createdAt: a setting's first write and its later edits are the same
    // event as far as the UI is concerned.
    timestamps: { createdAt: false, updatedAt: "updated_at" },
    versionKey: false,
  },
);

export const Setting = model<ISetting>("Setting", settingSchema);

/**
 * Gym-wide settings.
 *
 * Settings are stored one document per key but read and written as a flat
 * object; the translation lives here so nothing above this layer knows the
 * storage shape.
 *
 * Every key has a default, so a gym that has never opened the settings screen
 * behaves identically to one that saved the defaults explicitly.
 */
import {
  SETTING_KEYS,
  TRAINER_VISIBILITY,
  type TrainerVisibility,
} from "../config/constants.js";
import type { SettingsRead, SettingsUpdateInput } from "../dtos/setting.dto.js";
import { settingRepository } from "../repositories/index.js";

/** Read a stored value that should be a list of ids, tolerating anything else. */
function toIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

/** Read a stored visibility value, falling back to the default if unrecognised. */
function toVisibility(value: unknown): TrainerVisibility {
  return value === TRAINER_VISIBILITY.ALL
    ? TRAINER_VISIBILITY.ALL
    : TRAINER_VISIBILITY.ASSIGNED;
}

export const settingService = {
  /** Current settings, with defaults filled in for keys never written. */
  async getSettings(): Promise<SettingsRead> {
    const stored = await settingRepository.findAll();
    return {
      trainer_visibility: toVisibility(stored.get(SETTING_KEYS.TRAINER_VISIBILITY)),
      trainer_visibility_overrides: toIdList(
        stored.get(SETTING_KEYS.TRAINER_VISIBILITY_OVERRIDES),
      ),
    };
  },

  /** Apply a partial update and return the full resulting settings. */
  async updateSettings(payload: SettingsUpdateInput): Promise<SettingsRead> {
    const writes: Promise<unknown>[] = [];

    if (payload.trainer_visibility !== undefined) {
      writes.push(
        settingRepository.upsert(
          SETTING_KEYS.TRAINER_VISIBILITY,
          payload.trainer_visibility,
        ),
      );
    }
    if (payload.trainer_visibility_overrides !== undefined) {
      writes.push(
        settingRepository.upsert(
          SETTING_KEYS.TRAINER_VISIBILITY_OVERRIDES,
          // Duplicates would make the list grow without changing its meaning.
          [...new Set(payload.trainer_visibility_overrides)],
        ),
      );
    }

    await Promise.all(writes);
    return this.getSettings();
  },

  /**
   * Whether the given trainer may see every member, or only those assigned to
   * them.
   *
   * The policy is one setting in three states: everyone sees all, named
   * trainers see all, or scope to assignment. Callers get the resolved answer
   * rather than the raw setting, so the overrides list — which names other
   * trainers — never has to leave this layer.
   */
  async trainerSeesAllMembers(trainerId: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (settings.trainer_visibility === TRAINER_VISIBILITY.ALL) return true;
    return settings.trainer_visibility_overrides.includes(String(trainerId));
  },
};

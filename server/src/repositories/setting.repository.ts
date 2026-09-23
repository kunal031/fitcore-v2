/**
 * Settings queries.
 *
 * Settings are read on paths that run per request (trainer scoping), so reads
 * are batched into a single query over the keys rather than one query per key.
 */
import { Setting, type SettingDoc } from "../models/Setting.js";

export const settingRepository = {
  /** Every stored setting, as a key-keyed map. Absent keys mean "use the default". */
  async findAll(): Promise<Map<string, unknown>> {
    const rows = await Setting.find().exec();
    return new Map(rows.map((row) => [row.key, row.value]));
  },

  /**
   * Write one key, creating it if it has never been set.
   *
   * Upsert rather than find-then-save: a setting's first write is
   * indistinguishable from an update, and this leaves no window where two
   * concurrent writes both decide the document is missing.
   */
  upsert(key: string, value: unknown): Promise<SettingDoc | null> {
    return Setting.findOneAndUpdate(
      { key },
      { $set: { value } },
      { upsert: true, new: true },
    ).exec();
  },
};

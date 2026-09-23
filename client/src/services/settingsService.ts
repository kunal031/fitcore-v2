import { api } from "../lib/axios";

/**
 * Gym-wide settings. Owner only, both read and write.
 *
 * Stored key-value on the backend but exchanged as a flat object, so the
 * client never has to know how it is kept.
 */
export interface Settings {
	/** "assigned" (default) | "all" — which members a trainer may see. */
	trainer_visibility: "assigned" | "all";
	/** Trainer ids exempt from the above: they see every member. */
	trainer_visibility_overrides: string[];
}

export async function getSettings() {
	const response = await api.get<{ data: Settings }>("/settings");
	return response.data.data;
}

/**
 * Partial update — only the keys passed are written, so saving one control
 * cannot blank the other.
 */
export async function updateSettings(payload: Partial<Settings>) {
	const response = await api.patch<{ data: Settings }>("/settings", payload);
	return response.data.data;
}

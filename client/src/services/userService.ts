import { api } from "../lib/axios";
import type { MemberProfile } from "../store/authStore";

export async function getMyProfile() {
	const response = await api.get<{ data: MemberProfile }>("/users/me");
	return response.data.data;
}

export interface ProfileUpdatePayload {
	full_name?: string;
	email?: string;
	dob?: string;
	blood_group?: string;
	gender?: string;
	address?: {
		street?: string;
		city?: string;
		state?: string;
		pincode?: string;
	};
}

export async function updateMyProfile(payload: ProfileUpdatePayload) {
	const response = await api.patch<{ data: MemberProfile }>("/users/me", payload);
	return response.data.data;
}

/**
 * A member's current plan, folded into their list row.
 *
 * Returned only when the list is fetched with `includeSubscription`, and null
 * for someone who has never bought a plan.
 *
 * `status` is the subscription's own status rather than a boolean: a plan ends
 * on two independent axes, so `exhausted` (visit quota spent) and `expired`
 * (calendar window closed) are different states and an active/expired flag
 * would mislabel one of them.
 */
export interface MemberSubscriptionSummary {
	subscription_id: string;
	plan_name: string;
	status: string;
	/** Visits left on the quota. */
	days_remaining: number;
	/** Calendar days left — a different number from the quota. */
	days_until_expiry: number;
	expires_on: string;
}

export interface MemberListItem {
	id: string;
	full_name: string;
	phone: string;
	email?: string | null;
	role: string;
	gym_meta: {
		joined_on: string;
		membership_status: string;
		assigned_trainer_id?: string | null;
		assigned_trainer_name?: string | null;
	};
	active_subscription_id?: string | null;
	loyalty_points: number;
	is_active: boolean;
	subscription?: MemberSubscriptionSummary | null;
}

export interface PaginatedMeta { page: number; limit: number; total: number; pages: number }

export interface MemberListResult {
	items: MemberListItem[];
	meta: PaginatedMeta;
	/**
	 * Whether the caller was served every member or only their assigned ones.
	 * A trainer is scoped to their own unless the gym widens it, so this lets
	 * the UI explain a short list instead of leaving it looking like a failure.
	 */
	scope?: "all" | "assigned";
}

/**
 * Trainer/Owner listing. Paginated — the backend caps `limit` at 100.
 *
 * `includeSubscription` folds each member's current plan into their row. It is
 * opt-in because the backend pays for an extra query to resolve it, and most
 * callers only need names.
 */
export async function listMembers(
	params: {
		page?: number;
		limit?: number;
		search?: string;
		role?: string;
		assignedTrainerId?: string;
		includeSubscription?: boolean;
	} = {},
) {
	const response = await api.get<{ data: MemberListResult }>("/users", {
		params: {
			page: params.page ?? 1,
			limit: params.limit ?? 50,
			search: params.search || undefined,
			role: params.role || undefined,
			assigned_trainer_id: params.assignedTrainerId || undefined,
			include: params.includeSubscription ? "subscription" : undefined,
		},
	});
	return response.data.data ?? { items: [], meta: { page: 1, limit: 50, total: 0, pages: 0 } };
}

/** Full profile for one member. Staff only. */
export async function getUserById(userId: string) {
	const response = await api.get<{ data: MemberProfile }>(`/users/${userId}`);
	return response.data.data;
}

export interface TrainerListItem {
	id: string;
	full_name: string;
	phone: string;
	email?: string | null;
	role: string;
	is_active: boolean;
	gym_meta: { joined_on: string; membership_status: string };
}

/** Every active trainer. Owner only. */
export async function listTrainers() {
	const response = await api.get<{ data: TrainerListItem[] }>("/users/trainers");
	return response.data.data ?? [];
}

export interface UserCreatePayload {
	full_name: string;
	phone: string;
	password: string;
	role: "member" | "trainer";
	email?: string;
}

/** Create a walk-in member or a new trainer. Owner only. */
export async function createUser(payload: UserCreatePayload) {
	const response = await api.post<{ data: MemberListItem }>("/users", payload);
	return response.data.data;
}

/**
 * Point a member at a trainer. Owner only.
 *
 * Assignment runs one way only — from the gym user's side — so there is a
 * single place to reason about who a member belongs to.
 */
export async function assignTrainer(userId: string, trainerId: string) {
	const response = await api.post<{ data: MemberListItem }>(
		`/users/${userId}/assign-trainer`,
		{ trainer_id: trainerId },
	);
	return response.data.data;
}

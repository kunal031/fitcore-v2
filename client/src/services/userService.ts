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

export interface MemberListItem {
	id: string;
	full_name: string;
	phone: string;
	email?: string | null;
	role: string;
	gym_meta: { joined_on: string; membership_status: string; assigned_trainer_id?: string | null };
	active_subscription_id?: string | null;
	loyalty_points: number;
	is_active: boolean;
}

export interface PaginatedMeta { page: number; limit: number; total: number; pages: number }

/** Trainer/Owner listing. Paginated — the backend caps `limit` at 100. */
export async function listMembers(params: { page?: number; limit?: number; search?: string; role?: string } = {}) {
	const response = await api.get<{ data: { items: MemberListItem[]; meta: PaginatedMeta } }>("/users", {
		params: { page: params.page ?? 1, limit: params.limit ?? 50, search: params.search || undefined, role: params.role || undefined },
	});
	return response.data.data ?? { items: [], meta: { page: 1, limit: 50, total: 0, pages: 0 } };
}

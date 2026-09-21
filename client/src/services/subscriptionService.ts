import { api } from "../lib/axios";

export interface AttendanceEntry {
	date: string;
	check_in_time: string;
	check_out_time?: string | null;
	marked_by: string;
}

export interface Subscription {
	id: string;
	user_id: string;
	plan_id: string;
	payment_id: string;
	plan_snapshot: {
		plan_name: string;
		price_paise: number;
		allocated_days: number;
		calendar_days: number;
		features: string[];
	};
	status: string;
	allocated_days: number;
	days_used: number;
	days_remaining: number;
	starts_on: string;
	expires_on: string;
	days_until_expiry: number;
	attendance_log: AttendanceEntry[];
	created_at: string;
}

interface ApiResponse<T> { data: T; message?: string; success?: boolean }

export async function getActiveSubscription() {
	const response = await api.get<ApiResponse<Subscription | null>>("/subscriptions/me");
	return response.data.data;
}

export async function getSubscriptionHistory() {
	const response = await api.get<ApiResponse<Subscription[]>>("/subscriptions/me/history");
	return response.data.data ?? [];
}

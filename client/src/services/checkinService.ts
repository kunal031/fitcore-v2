import { api } from "../lib/axios";

export interface CheckInMemberSummary {
	id: string;
	full_name: string;
	phone: string;
	avatar_url?: string | null;
}

export interface CheckInResult {
	member: CheckInMemberSummary;
	check_in_time: string;
	days_remaining: number;
	allocated_days: number;
	/** False when the member was already marked present earlier today. */
	is_first_today: boolean;
}

export interface TodayCheckIn {
	member: CheckInMemberSummary;
	check_in_time: string;
	days_remaining: number;
}

export async function markAttendance(memberId: string) {
	const response = await api.post<{ data: CheckInResult; message?: string }>("/checkin", {
		member_id: memberId,
	});
	return response.data;
}

export async function getTodayCheckIns() {
	const response = await api.get<{ data: TodayCheckIn[] }>("/checkin/today");
	return response.data.data ?? [];
}

export interface TrainerDashboard {
	checkins_today: number;
	expiring_soon_count: number;
	last_checkin: { member_name: string; time: string } | null;
}

/** Trainer/Admin floor summary: today's attendance and renewals due. */
export async function getTrainerDashboard() {
	const response = await api.get<{ data: TrainerDashboard }>("/dashboard/trainer");
	return response.data.data;
}

export interface AttendanceRecord {
	date: string;
	check_in_time: string;
	check_out_time?: string | null;
	marked_by: string;
}

/** Every attendance entry for a member, across all their subscriptions. */
export async function getMemberAttendance(memberId: string) {
	const response = await api.get<{ data: AttendanceRecord[] }>("/checkin/history", {
		params: { member_id: memberId },
	});
	return response.data.data ?? [];
}

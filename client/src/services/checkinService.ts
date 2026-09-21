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

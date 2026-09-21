import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "owner" | "trainer" | "member";

export interface AuthUser {
	id: string;
	full_name: string;
	phone: string;
	role: UserRole;
	membership_status: string;
}

export interface MemberProfile extends AuthUser {
	email?: string | null;
	profile?: {
		dob?: string | null;
		blood_group?: string | null;
		gender?: string | null;
		address?: { street?: string | null; city?: string | null; state?: string | null; pincode?: string | null };
	};
	gym_meta?: { joined_on: string; membership_status: string; assigned_trainer_id?: string | null; assigned_trainer_name?: string | null };
	active_subscription_id?: string | null;
	my_referral_code?: string;
	loyalty_points?: number;
}

interface AuthState {
	user: AuthUser | null;
	accessToken: string | null;
	refreshToken: string | null;
	setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void;
	clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			accessToken: null,
			refreshToken: null,
			setSession: (user, accessToken, refreshToken) => {
				localStorage.setItem("fitcore_access_token", accessToken);
				localStorage.setItem("fitcore_refresh_token", refreshToken);
				set({ user, accessToken, refreshToken });
			},
			clearSession: () => {
				localStorage.removeItem("fitcore_access_token");
				localStorage.removeItem("fitcore_refresh_token");
				set({ user: null, accessToken: null, refreshToken: null });
			},
		}),
		{ name: "fitcore-session" },
	),
);

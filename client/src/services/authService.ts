import { api } from "../lib/axios";
import type { AuthUser } from "../store/authStore";

interface ApiResponse<T> {
	data: T;
	message?: string;
}

export interface AuthResult {
	user: AuthUser;
	access_token: string;
	refresh_token: string;
}

export async function login(identifier: string, password: string): Promise<AuthResult> {
	const response = await api.post<ApiResponse<AuthResult>>("/auth/login", {
		identifier,
		password,
	});
	return response.data.data;
}

export async function register(payload: {
	full_name: string;
	phone: string;
	email: string;
	password: string;
	referral_code?: string;
}): Promise<AuthResult> {
	const response = await api.post<ApiResponse<AuthResult>>("/auth/register", payload);
	return response.data.data;
}

export async function logout(): Promise<void> {
	await api.post("/auth/logout");
}

/**
 * Start a password reset.
 *
 * Always resolves, whether or not the address is registered — the backend
 * deliberately gives nothing away, so the UI must not either.
 */
export async function requestPasswordReset(email: string): Promise<void> {
	await api.post("/auth/send-otp", { email });
}

/** Exchange a code for a short-lived reset token. Rejects on a bad code. */
export async function verifyResetOtp(email: string, otp: string): Promise<string> {
	const response = await api.post<ApiResponse<{ verified: boolean; reset_token: string }>>(
		"/auth/verify-otp",
		{ email, otp },
	);
	return response.data.data.reset_token;
}

export async function resetPassword(payload: {
	email: string;
	reset_token: string;
	new_password: string;
}): Promise<void> {
	await api.post("/auth/reset-password", payload);
}

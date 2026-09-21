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

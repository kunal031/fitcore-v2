import axios from "axios";

/**
 * Where the API lives.
 *
 * In development the Vite proxy forwards /api to the local server, so a
 * relative path is enough. A production build must be told explicitly via
 * VITE_API_BASE_URL — falling back to localhost there would build a site that
 * only works on the machine that built it, and fails for every visitor with a
 * connection error that looks like the backend is down.
 */
const apiBaseUrl =
	import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "/api/v1" : undefined);

export const api = axios.create({
	// vite.config.ts refuses to build without VITE_API_BASE_URL, so the
	// fallback here only ever applies in development.
	baseURL: apiBaseUrl ?? "/api/v1",
	headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem("fitcore_access_token");
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

export function apiErrorMessage(error: unknown): string {
	if (axios.isAxiosError(error)) {
		if (!error.response) {
			return "The backend cannot be reached. Start the API server and try again.";
		}
		return error.response.data?.message ?? `Request failed (${error.response.status}).`;
	}
	return "Something went wrong. Please try again.";
}

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

/**
 * Clear the session and return to login.
 *
 * Uses a full navigation rather than a router push so every component's
 * in-memory state is discarded — no stale screen can linger showing data the
 * signed-out user should no longer see.
 *
 * That means the host must serve index.html for /login rather than looking
 * for a file there; see vercel.json. Without that rewrite this lands on the
 * host's 404 page.
 */
export function endSession() {
	localStorage.removeItem("fitcore_access_token");
	localStorage.removeItem("fitcore_refresh_token");
	localStorage.removeItem("fitcore-session");
	if (window.location.pathname !== "/login") {
		window.location.replace("/login");
	}
}

/**
 * Refresh the access token, sharing one request across concurrent failures.
 *
 * A dashboard fires several requests at once; without this, each 401 would
 * start its own refresh, and all but one would be rejected for reusing a
 * spent token — logging the user out mid-session.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
	const refreshToken = localStorage.getItem("fitcore_refresh_token");
	if (!refreshToken) return null;

	refreshInFlight ??= (async () => {
		try {
			// A bare axios call: the instance below would recurse through this
			// same interceptor on failure.
			const response = await axios.post<{
				data: { access_token: string; refresh_token: string };
			}>(`${apiBaseUrl ?? "/api/v1"}/auth/refresh`, { refresh_token: refreshToken });

			const { access_token, refresh_token } = response.data.data;
			localStorage.setItem("fitcore_access_token", access_token);
			localStorage.setItem("fitcore_refresh_token", refresh_token);
			return access_token;
		} catch {
			return null;
		} finally {
			refreshInFlight = null;
		}
	})();

	return refreshInFlight;
}

/**
 * On a 401, try once to refresh and replay the request; sign out if that
 * fails.
 *
 * Without this an expired token left the app half signed in — the user
 * object persists separately, so the shell rendered while every panel came
 * back empty.
 */
api.interceptors.response.use(
	(response) => response,
	async (error: unknown) => {
		if (!axios.isAxiosError(error) || error.response?.status !== 401) {
			return Promise.reject(error);
		}

		const request = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

		// The refresh call itself failing, or a second failure on the same
		// request, means the session is genuinely over.
		if (!request || request._retried || request.url?.includes("/auth/refresh")) {
			endSession();
			return Promise.reject(error);
		}

		const token = await refreshAccessToken();
		if (!token) {
			endSession();
			return Promise.reject(error);
		}

		request._retried = true;
		request.headers = request.headers ?? {};
		request.headers.Authorization = `Bearer ${token}`;
		return api(request);
	},
);

export function apiErrorMessage(error: unknown): string {
	if (axios.isAxiosError(error)) {
		if (!error.response) {
			return "The backend cannot be reached. Start the API server and try again.";
		}
		return error.response.data?.message ?? `Request failed (${error.response.status}).`;
	}
	return "Something went wrong. Please try again.";
}

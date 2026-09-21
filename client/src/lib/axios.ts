import axios from "axios";

export const api = axios.create({
	baseURL:
		import.meta.env.VITE_API_BASE_URL ??
		(import.meta.env.DEV ? "/api/v1" : "http://localhost:8000/api/v1"),
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

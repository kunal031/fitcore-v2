/// <reference types="node" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
	// loadEnv reads .env files as well as the shell, so a value set either way
	// counts — and it avoids needing Node types for process.env here.
	const env = loadEnv(mode, process.cwd(), "VITE_");
	// A production build bakes the API URL into the bundle, so it has to be
	// present at build time. Failing here beats shipping a site that loads and
	// then cannot reach its backend — the browser error for that looks like
	// the API is down rather than misconfigured.
	if (command === "build" && !env.VITE_API_BASE_URL) {
		throw new Error(
			"VITE_API_BASE_URL is required for a production build.\n" +
				"Set it to your deployed API, e.g.\n" +
				"  VITE_API_BASE_URL=https://your-api.onrender.com/api/v1",
		);
	}

	return {
		plugins: [react()],
		server: {
			port: 5173,
			// Forwards /api to the local backend, so development needs no
			// VITE_API_BASE_URL at all.
			proxy: {
				"/api": "http://localhost:8000",
			},
		},
	};
});

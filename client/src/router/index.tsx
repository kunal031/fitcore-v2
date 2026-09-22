import { Navigate, Route, Routes } from "react-router-dom";

import { useAuthStore } from "../store/authStore";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import DashboardPage from "../pages/shared/DashboardPage";

/** Sends signed-out visitors to login, preserving nothing sensitive in the URL. */
function ProtectedRoute() {
	const user = useAuthStore((state) => state.user);
	return user ? <DashboardPage /> : <Navigate to="/login" replace />;
}

/** Keeps signed-in users out of the auth screens. */
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
	const user = useAuthStore((state) => state.user);
	return user ? <Navigate to="/app/home" replace /> : <>{children}</>;
}

export default function App() {
	return (
		<Routes>
			<Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
			<Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

			{/*
			 * Each dashboard tab is a path segment under /app, so views can be
			 * bookmarked and the browser back button moves between them. The
			 * wildcard lets the dashboard read the segment itself rather than
			 * duplicating the tab list here.
			 */}
			<Route path="/app/*" element={<ProtectedRoute />} />

			{/* Legacy entry point, and anything unrecognised. */}
			<Route path="/" element={<Navigate to="/app/home" replace />} />
			<Route path="*" element={<Navigate to="/app/home" replace />} />
		</Routes>
	);
}

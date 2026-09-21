import { Navigate, Route, Routes } from "react-router-dom";

import { useAuthStore } from "../store/authStore";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import DashboardPage from "../pages/shared/DashboardPage";

function ProtectedRoute() {
	const user = useAuthStore((state) => state.user);
	return user ? <DashboardPage /> : <Navigate to="/login" replace />;
}

export default function App() {
	return (
		<Routes>
			<Route path="/login" element={<LoginPage />} />
			<Route path="/register" element={<RegisterPage />} />
			<Route path="/" element={<ProtectedRoute />} />
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}

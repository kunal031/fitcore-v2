import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Dumbbell } from "lucide-react";

import { apiErrorMessage } from "../../lib/axios";
import { login } from "../../services/authService";
import { useAuthStore } from "../../store/authStore";

export default function LoginPage() {
	const navigate = useNavigate();
	const setSession = useAuthStore((state) => state.setSession);
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setLoading(true);
		try {
			const result = await login(identifier, password);
			setSession(result.user, result.access_token, result.refresh_token);
			navigate("/", { replace: true });
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="auth-layout">
			<section className="auth-art">
				<div className="brand"><span className="brand-mark"><Dumbbell size={18} /></span><span className="brand-text">FITCORE</span></div>
				<h1>Train with intention.</h1>
				<p>A calmer, clearer way to manage your gym journey, from your first plan to every check-in.</p>
			</section>
			<section className="auth-panel">
				<div className="auth-card">
					<p className="eyebrow">Member portal</p>
					<h2>Welcome back.</h2>
					<p className="muted">Sign in to see your plan, attendance, rewards, and more.</p>
					<form onSubmit={handleSubmit}>
						<div className="field"><label htmlFor="identifier">Phone or email</label><input id="identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="you@example.com" required /></div>
						<div className="field"><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></div>
						{error && <div className="error-message" role="alert">{error}</div>}
						<button className="primary-button" type="submit" disabled={loading}>{loading ? "Signing in..." : <>Sign in <ArrowRight size={16} /></>}</button>
					</form>
					<p className="muted">New to FitCore? <Link to="/register">Create a member account</Link></p>
					<div className="demo-note">Development accounts are available through the backend seed script. Admin, Trainer, and Member roles will open their own dashboard view.</div>
				</div>
			</section>
		</main>
	);
}

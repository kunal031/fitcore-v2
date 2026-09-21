import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Dumbbell } from "lucide-react";

import { apiErrorMessage } from "../../lib/axios";
import { register } from "../../services/authService";
import { useAuthStore } from "../../store/authStore";

export default function RegisterPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const setSession = useAuthStore((state) => state.setSession);
	const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "", referral_code: searchParams.get("ref")?.toUpperCase() ?? "" });
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setLoading(true);
		try {
			const result = await register(form);
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
			<section className="auth-art"><div className="brand"><span className="brand-mark"><Dumbbell size={18} /></span><span className="brand-text">FITCORE</span></div><h1>Start your next chapter.</h1><p>Build a steady rhythm with a plan that fits your goals and a record that keeps you moving.</p></section>
			<section className="auth-panel"><div className="auth-card"><p className="eyebrow">Join FitCore</p><h2>Create your account.</h2><p className="muted">Your member account starts with a few simple details.</p>
				<form onSubmit={handleSubmit}>
					<div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required /></div>
					<div className="field"><label htmlFor="phone">Phone</label><input id="phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="10-digit Indian number" required /></div>
					<div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
					<div className="field"><label htmlFor="password">Password</label><input id="password" type="password" minLength={6} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></div>
					<div className="field"><label htmlFor="referral_code">Referral code <span className="optional-label">optional</span></label><input id="referral_code" value={form.referral_code} onChange={(event) => setForm({ ...form, referral_code: event.target.value.toUpperCase() })} placeholder="e.g. ARJUN001" /></div>
					{error && <div className="error-message" role="alert">{error}</div>}
					<button className="primary-button" type="submit" disabled={loading}>{loading ? "Creating account..." : <>Create account <ArrowRight size={16} /></>}</button>
				</form>
				<p className="muted">Already registered? <Link to="/login">Return to sign in</Link></p>
			</div></section>
		</main>
	);
}

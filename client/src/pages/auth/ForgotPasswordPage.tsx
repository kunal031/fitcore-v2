import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Dumbbell, MailCheck } from "lucide-react";

import gymHero from "../../assets/images/gym-hero.webp";
import { apiErrorMessage } from "../../lib/axios";
import { requestPasswordReset, resetPassword, verifyResetOtp } from "../../services/authService";

/** Kept in step with OTP_EXPIRY_MINUTES on the server. */
const CODE_EXPIRY_MINUTES = 5;

type Step = "email" | "code" | "password" | "done";

/**
 * Password reset, in three steps on one screen.
 *
 * One component rather than three routes because the steps share state that
 * only matters together — the address, the code and the reset token are
 * useless apart, and a reload partway through should start over rather than
 * land on a step with nothing behind it.
 *
 * Reset is email-only: the code is emailed, so an account with no address on
 * file cannot self-serve and is told to ask gym staff.
 */
export default function ForgotPasswordPage() {
	const navigate = useNavigate();
	const [step, setStep] = useState<Step>("email");
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [resetToken, setResetToken] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [loading, setLoading] = useState(false);

	async function submitEmail(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(""); setLoading(true);
		try {
			await requestPasswordReset(email.trim());
			// Moves on regardless: the server will not say whether the address is
			// registered, so neither can this screen.
			setNotice(`If ${email.trim()} is registered, a code is on its way.`);
			setStep("code");
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setLoading(false);
		}
	}

	async function submitOtp(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(""); setLoading(true);
		try {
			setResetToken(await verifyResetOtp(email.trim(), otp.trim()));
			setNotice("");
			setStep("password");
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setLoading(false);
		}
	}

	async function submitPassword(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (password !== confirm) {
			setError("The two passwords do not match.");
			return;
		}
		setError(""); setLoading(true);
		try {
			await resetPassword({
				email: email.trim(),
				reset_token: resetToken,
				new_password: password,
			});
			setStep("done");
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setLoading(false);
		}
	}

	async function resend() {
		setError(""); setLoading(true);
		try {
			await requestPasswordReset(email.trim());
			setNotice("A new code has been sent. The previous one no longer works.");
			setOtp("");
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="auth-layout">
			<section className="auth-art">
				<img className="auth-art-image" src={gymHero} alt="" aria-hidden="true" />
				<div className="auth-art-content">
					<div className="brand"><span className="brand-mark"><Dumbbell size={18} /></span><span className="brand-text">FITCORE</span></div>
				</div>
			</section>

			<section className="auth-panel">
				<div className="auth-card">
					{step === "email" && (
						<>
							<h2>Forgot your password?</h2>
							<p className="muted">
								Enter the email on your account and we will send a reset code.
							</p>
							<form onSubmit={submitEmail}>
								<div className="field">
									<label htmlFor="email">Email</label>
									<input
										id="email"
										type="email"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										placeholder="you@example.com"
										autoComplete="email"
										required
									/>
								</div>
								{error && <div className="error-message" role="alert">{error}</div>}
								<button className="primary-button" type="submit" disabled={loading}>
									{loading ? "Sending..." : <>Send code <ArrowRight size={16} /></>}
								</button>
							</form>
							<p className="muted">
								No email on your account? Ask gym staff to reset it for you.
							</p>
						</>
					)}

					{step === "code" && (
						<>
							<h2>Enter the code</h2>
							{notice && <p className="muted">{notice}</p>}
							<form onSubmit={submitOtp}>
								<div className="field">
									<label htmlFor="otp">6-digit code</label>
									<input
										id="otp"
										// inputMode rather than type=number, which strips leading
										// zeros and adds stepper arrows nobody wants on a code.
										inputMode="numeric"
										autoComplete="one-time-code"
										value={otp}
										onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
										placeholder="123456"
										required
									/>
								</div>
								{error && <div className="error-message" role="alert">{error}</div>}
								<button className="primary-button" type="submit" disabled={loading || otp.length < 4}>
									{loading ? "Checking..." : <>Verify code <ArrowRight size={16} /></>}
								</button>
							</form>
							<p className="muted">
								The code expires in {CODE_EXPIRY_MINUTES} minutes.{" "}
								<button className="text-button" type="button" onClick={() => void resend()} disabled={loading}>
									Send a new one
								</button>
							</p>
							<p className="muted">
								<button className="text-button" type="button" onClick={() => { setStep("email"); setError(""); setNotice(""); }}>
									<ArrowLeft size={14} /> Use a different email
								</button>
							</p>
						</>
					)}

					{step === "password" && (
						<>
							<h2>Choose a new password</h2>
							<form onSubmit={submitPassword}>
								<div className="field">
									<label htmlFor="new-password">New password</label>
									<input
										id="new-password"
										type="password"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										placeholder="At least 6 characters"
										autoComplete="new-password"
										minLength={6}
										required
									/>
								</div>
								<div className="field">
									<label htmlFor="confirm-password">Confirm password</label>
									<input
										id="confirm-password"
										type="password"
										value={confirm}
										onChange={(event) => setConfirm(event.target.value)}
										placeholder="Type it again"
										autoComplete="new-password"
										minLength={6}
										required
									/>
								</div>
								{error && <div className="error-message" role="alert">{error}</div>}
								<button className="primary-button" type="submit" disabled={loading}>
									{loading ? "Saving..." : <>Set new password <ArrowRight size={16} /></>}
								</button>
							</form>
						</>
					)}

					{step === "done" && (
						<>
							<div className="auth-success"><MailCheck size={30} /></div>
							<h2>Password changed.</h2>
							<p className="muted">
								You can sign in with your new password now.
							</p>
							<button className="primary-button" type="button" onClick={() => navigate("/login", { replace: true })}>
								Go to sign in <ArrowRight size={16} />
							</button>
						</>
					)}

					{step !== "done" && (
						<p className="muted">
							Remembered it? <Link to="/login">Back to sign in</Link>
						</p>
					)}
				</div>
			</section>
		</main>
	);
}

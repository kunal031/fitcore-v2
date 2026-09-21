import { useEffect, useMemo, useState } from "react";
import { BadgeIndianRupee, CalendarDays, ChevronRight, CheckCircle2, CreditCard, Copy, Dumbbell, LogOut, Moon, Share2, Sparkles, Sun, Tag, Ticket, UserRound, Users } from "lucide-react";

import { apiErrorMessage } from "../../lib/axios";
import { logout } from "../../services/authService";
import { validateCoupon, type CouponValidation } from "../../services/couponService";
import { getPlans, type Plan } from "../../services/planService";
import { getMyReferrals, type ReferralInfo } from "../../services/referralService";
import { getActiveSubscription, getSubscriptionHistory, type Subscription } from "../../services/subscriptionService";
import { getMyProfile, updateMyProfile } from "../../services/userService";
import { getMyPayments, initiatePayment, verifyMockPayment, type PaymentDetail, type PaymentInitiation } from "../../services/paymentService";
import StaffWorkspace from "./StaffWorkspace";
import { useAuthStore, type MemberProfile } from "../../store/authStore";

type MemberTab = "home" | "plans" | "checkout" | "attendance" | "payments" | "referrals" | "profile";
const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not available";

export default function DashboardPage() {
  const { user, clearSession } = useAuthStore();
  const [tab, setTab] = useState<MemberTab>("home");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("fitcore_theme") !== "light");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [referrals, setReferrals] = useState<ReferralInfo | null>(null);
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("fitcore_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!user || user.role !== "member") { setLoading(false); return; }
    Promise.allSettled([
      getActiveSubscription(),
      getSubscriptionHistory(),
      getPlans(),
      getMyProfile(),
      getMyReferrals(),
      getMyPayments(),
    ]).then(([active, previous, availablePlans, memberProfile, referralInfo, paymentHistory]) => {
      if (active.status === "fulfilled") setSubscription(active.value);
      if (previous.status === "fulfilled") setHistory(previous.value);
      if (availablePlans.status === "fulfilled") setPlans(availablePlans.value);
      if (memberProfile.status === "fulfilled") setProfile(memberProfile.value);
      if (referralInfo.status === "fulfilled") setReferrals(referralInfo.value);
      if (paymentHistory.status === "fulfilled") setPayments(paymentHistory.value);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  async function handleLogout() { try { await logout(); } finally { clearSession(); window.location.assign("/login"); } }
  if (user.role !== "member") return <StaffWorkspace user={user} darkMode={darkMode} setDarkMode={setDarkMode} onLogout={handleLogout} />;

  const attendancePercent = subscription ? Math.round((subscription.days_used / subscription.allocated_days) * 100) : 0;
  const expirySoon = Boolean(subscription && subscription.days_until_expiry <= 5 && subscription.days_until_expiry >= 0);

  return <div className="dashboard"><header className="mobile-header"><div className="brand"><span className="brand-mark"><Dumbbell size={17} /></span><span className="brand-text">FITCORE</span></div><div className="header-actions"><button className="icon-button" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button" onClick={handleLogout} aria-label="Sign out"><LogOut size={18} /></button></div></header><main className="member-main">{loading ? <div className="loading-state">Loading your gym space...</div> : <>{tab === "home" && <HomeView user={user} subscription={subscription} attendancePercent={attendancePercent} expirySoon={expirySoon} setTab={setTab} />}{tab === "plans" && <PlansView plans={plans} subscription={subscription} history={history} onChoosePlan={(plan) => { setSelectedPlan(plan); setTab("checkout"); }} />}{tab === "checkout" && selectedPlan && <CheckoutView plan={selectedPlan} onBack={() => setTab("plans")} onComplete={() => { setTab("home"); window.location.reload(); }} />}{tab === "attendance" && <AttendanceView subscription={subscription} />}{tab === "payments" && <PaymentsView payments={payments} />}{tab === "referrals" && <ReferralView referrals={referrals} />}{tab === "profile" && <ProfileView profile={profile} user={user} />}</>}</main><nav className="bottom-nav" aria-label="Main navigation">{([["home", Dumbbell, "Home"], ["plans", CreditCard, "Plans"], ["attendance", CalendarDays, "Track"], ["payments", BadgeIndianRupee, "Paid"], ["referrals", Share2, "Refer"], ["profile", UserRound, "Profile"]] as const).map(([key, Icon, label]) => <button className={tab === key ? "nav-item active" : "nav-item"} key={key} onClick={() => setTab(key)}><Icon size={19} /><span>{label}</span></button>)}</nav></div>;
}

function HomeView({ user, subscription, attendancePercent, expirySoon, setTab }: { user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>; subscription: Subscription | null; attendancePercent: number; expirySoon: boolean; setTab: (tab: MemberTab) => void }) {
  return <section className="view-stack"><div className="welcome-row"><div><p className="eyebrow">Member home</p><h1>Hey, {user.full_name.split(" ")[0]}.</h1></div><div className="avatar">{user.full_name.charAt(0)}</div></div>{expirySoon && <button className="renew-alert" onClick={() => setTab("plans")}><span><strong>Your plan ends in {subscription?.days_until_expiry} days.</strong><small>Renew now or explore another plan.</small></span><ChevronRight size={21} /></button>}<div className="hero-stat"><div className="stat-copy"><span>Current plan</span><strong>{subscription?.plan_snapshot.plan_name ?? "No active plan"}</strong><small>{subscription ? `${subscription.days_remaining} days left · expires ${dateLabel(subscription.expires_on)}` : "Choose a plan to start your membership"}</small></div><div className="progress-ring" style={{ "--progress": `${attendancePercent * 3.6}deg` } as React.CSSProperties}><span>{subscription ? subscription.days_remaining : 0}<small>left</small></span></div></div><div className="section-heading"><div><p className="eyebrow">Your pulse</p><h2>This week</h2></div><button className="text-button" onClick={() => setTab("attendance")}>See details <ChevronRight size={16} /></button></div><div className="insight-grid"><article className="insight-card accent-card"><CalendarDays size={19} /><strong>{subscription?.days_used ?? 0}</strong><span>days used</span></article><article className="insight-card"><Sparkles size={19} /><strong>{user.membership_status === "active" ? "Active" : "Ready"}</strong><span>membership</span></article><article className="insight-card"><Users size={19} /><strong>Later</strong><span>rewards API</span></article></div><div className="quick-actions"><button onClick={() => setTab("plans")}>Explore plans <ChevronRight size={17} /></button><button onClick={() => setTab("referrals")}>Invite a friend <ChevronRight size={17} /></button></div></section>;
}

function PlansView({ plans, subscription, history, onChoosePlan }: { plans: Plan[]; subscription: Subscription | null; history: Subscription[]; onChoosePlan: (plan: Plan) => void }) {
  return <section className="view-stack"><PageTitle eyebrow="Plans & passes" title="Choose your pace." subtitle="Your current membership, options to renew, and every pass you have bought." />{subscription && <article className="current-plan"><div><span className="status-dot">Active now</span><h3>{subscription.plan_snapshot.plan_name}</h3><p>{subscription.days_remaining} days left · {dateLabel(subscription.expires_on)}</p></div><strong>{money(subscription.plan_snapshot.price_paise)}</strong></article>}<div className="section-heading"><h2>Available plans</h2><span className="muted">{plans.length} options</span></div><div className="plan-list">{plans.map((plan) => <article className="plan-card" key={plan.id}><div className="plan-card-top"><span className="plan-category">{plan.category}</span><strong>{money(plan.price_paise)}</strong></div><h3>{plan.plan_name}</h3><p>{plan.description}</p><div className="plan-meta"><span>{plan.calendar_days} calendar days</span><span>{plan.allocated_days} gym visits</span></div><ul>{plan.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}</ul><button className="outline-button" onClick={() => onChoosePlan(plan)}>Buy this plan <ChevronRight size={16} /></button></article>)}</div>{history.length > 0 && <><div className="section-heading"><h2>Previous passes</h2></div><div className="history-list">{history.map((item) => <article className="history-row" key={item.id}><div><strong>{item.plan_snapshot.plan_name}</strong><span>{dateLabel(item.created_at)} · {item.status}</span></div><strong>{money(item.plan_snapshot.price_paise)}</strong></article>)}</div></>}</section>;
}

function CheckoutView({ plan, onBack, onComplete }: { plan: Plan; onBack: () => void; onComplete: () => void }) {
  const [payment, setPayment] = useState<PaymentInitiation | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"ready" | "starting" | "verifying" | "success">("ready");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  // An applied coupon is only trustworthy for the plan it was validated against.
  const appliedCode = coupon?.valid ? coupon.code : undefined;
  const discountPaise = coupon?.valid ? coupon.discount_paise : 0;
  const payablePaise = coupon?.valid ? coupon.final_paise : plan.price_paise;

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponChecking(true); setError("");
    try {
      // Returns 200 with valid:false + reason for a rejected coupon.
      setCoupon(await validateCoupon(code, plan.id));
    } catch (requestError) {
      setCoupon(null);
      setError(apiErrorMessage(requestError));
    } finally { setCouponChecking(false); }
  }

  function removeCoupon() { setCoupon(null); setCouponInput(""); }

  async function startPayment() {
    setError(""); setStatus("starting");
    try {
      const initiated = await initiatePayment(plan.id, appliedCode);
      setPayment(initiated);
      setStatus("verifying");
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      await verifyMockPayment(initiated);
      setStatus("success");
    } catch (requestError) {
      setStatus("ready");
      setError(apiErrorMessage(requestError));
    }
  }

  if (status === "success") return <section className="view-stack"><div className="success-panel"><div className="success-mark">✓</div><p className="eyebrow">Payment complete</p><h1>Your plan is active.</h1><p className="muted">Your mock payment was verified and your subscription has been created.</p><button className="primary-action" onClick={onComplete}>Go to my home <ChevronRight size={17} /></button></div></section>;

  return <section className="view-stack"><button className="back-button" onClick={onBack}>← Back to plans</button><PageTitle eyebrow="Checkout" title="Make it official." subtitle="Review your plan, apply a coupon, and complete the mock payment." /><article className="checkout-card"><div className="checkout-plan"><span className="plan-category">{plan.category}</span><h2>{plan.plan_name}</h2><p>{plan.description}</p></div>
    <div className="coupon-box">
      <label htmlFor="coupon-code">Have a coupon?</label>
      <div className="coupon-row">
        <input id="coupon-code" value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} placeholder="Enter code" disabled={Boolean(appliedCode) || status !== "ready"} autoCapitalize="characters" spellCheck={false} />
        {appliedCode
          ? <button className="outline-button compact-button" onClick={removeCoupon} disabled={status !== "ready"}>Remove</button>
          : <button className="outline-button compact-button" onClick={applyCoupon} disabled={couponChecking || !couponInput.trim() || status !== "ready"}>{couponChecking ? "Checking..." : "Apply"}</button>}
      </div>
      {coupon && (coupon.valid
        ? <p className="coupon-ok"><Tag size={14} /> {coupon.code} applied{coupon.description ? ` · ${coupon.description}` : ""} — you save {money(coupon.discount_paise)}.</p>
        : <p className="coupon-bad">{coupon.reason ?? "This coupon cannot be used."}</p>)}
    </div>
    <div className="price-lines">
      <div className="price-line"><span>Plan price</span><span>{money(plan.price_paise)}</span></div>
      {discountPaise > 0 && <div className="price-line discount"><span>Coupon {appliedCode}</span><span>−{money(discountPaise)}</span></div>}
    </div>
    <div className="checkout-total"><span>Total today</span><strong>{money(payment?.amount_paise ?? payablePaise)}</strong></div><div className="mock-gateway"><span className="gateway-badge">MOCK</span><div><strong>FitCore test payment</strong><p>No real money will be charged.</p></div></div>{error && <div className="error-message">{error}</div>}<button className="primary-action" onClick={startPayment} disabled={status !== "ready"}>{status === "starting" ? "Creating payment..." : status === "verifying" ? "Verifying payment..." : "Pay securely"} <ChevronRight size={17} /></button></article></section>;
}

function AttendanceView({ subscription }: { subscription: Subscription | null }) {
  const attended = useMemo(() => new Set(subscription?.attendance_log.map((entry) => entry.date) ?? []), [subscription]);
  return <section className="view-stack"><PageTitle eyebrow="Attendance" title="Show up for yourself." subtitle="Your trainer or Admin records your gym entry. Here is your progress so far." />{subscription ? <><div className="attendance-summary"><div><span>Days used</span><strong>{subscription.days_used}</strong></div><div><span>Days remaining</span><strong>{subscription.days_remaining}</strong></div><div><span>Visits logged</span><strong>{attended.size}</strong></div></div><div className="section-heading"><h2>Recent visits</h2></div><div className="history-list">{subscription.attendance_log.length ? subscription.attendance_log.slice().reverse().map((entry) => <article className="history-row" key={`${entry.date}-${entry.check_in_time}`}><div><strong>{dateLabel(entry.date)}</strong><span>Checked in at {new Date(entry.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><span className="status-dot">Logged</span></article>) : <div className="empty-state">No attendance has been recorded yet.</div>}</div></> : <div className="empty-state">Buy a plan to start tracking attendance.</div>}</section>;
}

function PaymentsView({ payments }: { payments: PaymentDetail[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const successful = payments.filter((item) => item.status === "success");
  const totalPaid = successful.reduce((sum, item) => sum + item.final_amount_paise, 0);
  const totalSaved = successful.reduce((sum, item) => sum + item.discount_paise, 0);

  return <section className="view-stack"><PageTitle eyebrow="Payments" title="Every receipt, kept." subtitle="Your payment history and the details behind each transaction." />
    {payments.length === 0
      ? <div className="empty-state">You have not made any payments yet.</div>
      : <><div className="insight-grid">
          <article className="insight-card accent-card"><BadgeIndianRupee size={19} /><strong>{money(totalPaid)}</strong><span>total paid</span></article>
          <article className="insight-card"><Ticket size={19} /><strong>{money(totalSaved)}</strong><span>total saved</span></article>
          <article className="insight-card"><CheckCircle2 size={19} /><strong>{successful.length}</strong><span>successful</span></article>
        </div>
        <div className="section-heading"><h2>Transactions</h2><span className="muted">{payments.length} total</span></div>
        <div className="history-list">{payments.map((item) => {
          const open = openId === item.id;
          return <article className={open ? "payment-row open" : "payment-row"} key={item.id}>
            <button className="payment-row-head" onClick={() => setOpenId(open ? null : item.id)} aria-expanded={open}>
              <div><strong>{item.receipt_number}</strong><span>{dateLabel(item.created_at)} · {item.payment_method.toUpperCase()}</span></div>
              <div className="payment-row-right"><strong>{money(item.final_amount_paise)}</strong><span className={item.status === "success" ? "status-dot" : "status-dot failed"}>{item.status}</span></div>
            </button>
            {open && <div className="payment-detail">
              <Detail label="Receipt number" value={item.receipt_number} />
              <Detail label="Status" value={item.status} />
              <Detail label="Paid on" value={dateLabel(item.created_at)} />
              <Detail label="Method" value={item.payment_method.toUpperCase()} />
              <Detail label="Plan price" value={money(item.amount_paise)} />
              <Detail label="Discount" value={item.discount_paise > 0 ? `−${money(item.discount_paise)}` : "No discount"} />
              <Detail label="Amount paid" value={money(item.final_amount_paise)} />
              {item.gateway_payment_id && <Detail label="Gateway payment ID" value={item.gateway_payment_id} />}
              {item.gateway_order_id && <Detail label="Gateway order ID" value={item.gateway_order_id} />}
              {item.note && <Detail label="Note" value={item.note} />}
            </div>}
          </article>;
        })}</div></>}
  </section>;
}

function ReferralView({ referrals }: { referrals: ReferralInfo | null }) {
  const [notice, setNotice] = useState("");
  const shareLink = referrals ? `${window.location.origin}/register?ref=${encodeURIComponent(referrals.my_referral_code)}` : "";
  async function copyCode() { if (referrals) { await navigator.clipboard?.writeText(shareLink); setNotice("Referral link copied."); } }
  async function shareCode() { if (!referrals) return; if (navigator.share) await navigator.share({ title: "Join me at FitCore", text: `Join FitCore with my referral code ${referrals.my_referral_code}.`, url: shareLink }); else await copyCode(); }
  return <section className="view-stack"><PageTitle eyebrow="Referrals" title="Bring your people in." subtitle="Share your code and keep an eye on the friends who join." />{referrals ? <><div className="referral-code"><div><span>Your referral code</span><strong>{referrals.my_referral_code}</strong><small>{shareLink}</small></div><div className="referral-actions"><button className="icon-button" onClick={copyCode} aria-label="Copy referral link"><Copy size={18} /></button><button className="share-button" onClick={shareCode}>Share</button></div></div>{notice && <div className="profile-message">{notice}</div>}<div className="insight-grid"><article className="insight-card"><Users size={19} /><strong>{referrals.stats.total_referrals}</strong><span>people referred</span></article><article className="insight-card accent-card"><Sparkles size={19} /><strong>{referrals.stats.total_points_earned}</strong><span>points earned</span></article></div><div className="section-heading"><h2>Referral history</h2></div><div className="history-list">{referrals.referred_members.length ? referrals.referred_members.map((member) => <article className="history-row" key={member.user_id}><div><strong>{member.full_name}</strong><span>Joined {dateLabel(member.joined_on)}</span></div><span className={member.has_purchased ? "status-dot" : "muted"}>{member.has_purchased ? "Converted" : "Joined"}</span></article>) : <div className="empty-state">Share your code to start your referral history.</div>}</div></> : <div className="empty-state">Referral information is not available yet.</div>}</section>;
}

function LegacyProfileView({ profile, user }: { profile: MemberProfile | null; user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]> }) {
  return <section className="view-stack"><PageTitle eyebrow="Profile" title="Your details, in one place." subtitle="Review your account and membership information." /><div className="profile-card"><div className="profile-avatar">{user.full_name.charAt(0)}</div><div><h3>{profile?.full_name ?? user.full_name}</h3><p>{profile?.email ?? "No email added"}</p><span className="status-dot">{profile?.gym_meta?.membership_status ?? user.membership_status}</span></div></div><div className="detail-list"><Detail label="Phone" value={profile?.phone ?? user.phone} /><Detail label="Member since" value={dateLabel(profile?.gym_meta?.joined_on)} /><Detail label="Location" value={[profile?.profile?.address?.city, profile?.profile?.address?.state].filter(Boolean).join(", ") || "Not added"} /><Detail label="Points" value={`${profile?.loyalty_points ?? 0} loyalty points`} /></div><div className="later-card"><Sparkles size={20} /><div><strong>Rewards history is coming next.</strong><p>We will connect membership age, gym days, and plans bought when the Rewards API is ready.</p></div></div></section>;
}

function ProfileView({ profile, user }: { profile: MemberProfile | null; user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", dob: "", blood_group: "", gender: "", street: "", city: "", state: "", pincode: "" });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name,
      email: profile.email ?? "",
      dob: profile.profile?.dob ?? "",
      blood_group: profile.profile?.blood_group ?? "",
      gender: profile.profile?.gender ?? "",
      street: profile.profile?.address?.street ?? "",
      city: profile.profile?.address?.city ?? "",
      state: profile.profile?.address?.state ?? "",
      pincode: profile.profile?.address?.pincode ?? "",
    });
  }, [profile]);

  const change = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  async function saveProfile() {
    setSaving(true); setMessage("");
    try {
      const updated = await updateMyProfile({
        full_name: form.full_name,
        email: form.email || undefined,
        dob: form.dob || undefined,
        blood_group: form.blood_group || undefined,
        gender: form.gender || undefined,
        address: { street: form.street || undefined, city: form.city || undefined, state: form.state || undefined, pincode: form.pincode || undefined },
      });
      Object.assign(profile ?? {}, updated);
      setMessage("Profile updated successfully.");
      setEditing(false);
    } catch { setMessage("Profile could not be updated. Please try again."); }
    finally { setSaving(false); }
  }

  return <section className="view-stack"><PageTitle eyebrow="Profile" title="Your details, in one place." subtitle="Review and update your personal information." /><div className="profile-card"><div className="profile-avatar">{(profile?.full_name ?? user.full_name).charAt(0)}</div><div><h3>{profile?.full_name ?? user.full_name}</h3><p>{profile?.email ?? "No email added"}</p><span className="status-dot">{profile?.gym_meta?.membership_status ?? user.membership_status}</span></div><button className="outline-button compact-button" onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit profile"}</button></div>{message && <div className="profile-message">{message}</div>}{editing ? <div className="profile-form"><div className="field"><label>Full name</label><input value={form.full_name} onChange={change("full_name")} /></div><div className="field"><label>Phone <span className="optional-label">cannot be changed</span></label><input value={profile?.phone ?? user.phone} disabled /></div><div className="field"><label>Email <span className="optional-label">cannot be changed</span></label><input type="email" value={form.email} disabled /></div><div className="profile-form-grid"><div className="field"><label>Date of birth</label><input type="date" value={form.dob} onChange={change("dob")} /></div><div className="field"><label>Gender</label><input value={form.gender} onChange={change("gender")} placeholder="Not specified" /></div><div className="field"><label>Blood group</label><input value={form.blood_group} onChange={change("blood_group")} placeholder="e.g. B+" /></div><div className="field"><label>Street</label><input value={form.street} onChange={change("street")} /></div><div className="field"><label>City</label><input value={form.city} onChange={change("city")} /></div><div className="field"><label>State</label><input value={form.state} onChange={change("state")} /></div><div className="field"><label>Pincode</label><input value={form.pincode} onChange={change("pincode")} /></div></div><button className="primary-action" onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div> : <><div className="detail-list"><Detail label="Phone" value={profile?.phone ?? user.phone} /><Detail label="Email" value={profile?.email ?? "Not added"} /><Detail label="Date of birth" value={dateLabel(profile?.profile?.dob)} /><Detail label="Gender" value={profile?.profile?.gender ?? "Not added"} /><Detail label="Blood group" value={profile?.profile?.blood_group ?? "Not added"} /><Detail label="Address" value={[profile?.profile?.address?.street, profile?.profile?.address?.city, profile?.profile?.address?.state, profile?.profile?.address?.pincode].filter(Boolean).join(", ") || "Not added"} /><Detail label="Role" value={profile?.role === "owner" ? "Admin" : profile?.role ?? "Member"} /><Detail label="Member since" value={dateLabel(profile?.gym_meta?.joined_on)} /><Detail label="Assigned trainer" value={profile?.gym_meta?.assigned_trainer_name ?? "Not assigned"} /><Detail label="Referral code" value={profile?.my_referral_code ?? "Not available"} /><Detail label="Loyalty points" value={`${profile?.loyalty_points ?? 0} points`} /><Detail label="Active subscription" value={profile?.active_subscription_id ? "Active" : "None"} /></div><div className="later-card"><Sparkles size={20} /><div><strong>Rewards history is coming next.</strong><p>We will connect your membership age, gym days, and plans bought when the Rewards API is ready.</p></div></div></>}</section>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>; }
function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{subtitle}</p></div>; }

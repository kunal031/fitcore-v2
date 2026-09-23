import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeIndianRupee, CalendarDays, ChevronLeft, ChevronRight, Download, CheckCircle2, CreditCard, Copy, Dumbbell, LogOut, Moon, Share2, Sparkles, Sun, Tag, Ticket, UserRound, Users } from "lucide-react";

import { apiErrorMessage, endSession } from "../../lib/axios";
import { logout } from "../../services/authService";
import { getCoupons, validateCoupon, type Coupon, type CouponValidation } from "../../services/couponService";
import { getPlans, type Plan } from "../../services/planService";
import { getMyReferrals, type ReferralInfo } from "../../services/referralService";
import { getActiveSubscription, getSubscriptionHistory, type Subscription } from "../../services/subscriptionService";
import { getMyProfile, updateMyProfile } from "../../services/userService";
import { getMyPayments, initiatePayment, verifyMockPayment, type PaymentDetail, type PaymentInitiation } from "../../services/paymentService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StaffWorkspace from "./StaffWorkspace";
import { useTabRoute } from "../../hooks/useTabRoute";
import { useAuthStore, type MemberProfile } from "../../store/authStore";

const MEMBER_TABS = ["home", "plans", "checkout", "attendance", "payments", "referrals", "profile"] as const;
type MemberTab = (typeof MEMBER_TABS)[number];
const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not available";

/**
 * Picks the workspace for the signed-in role.
 *
 * The branch happens here, before any hook runs. Rendering StaffWorkspace from
 * inside the member component meant both called useTabRoute against the same
 * URL — hooks run before an early return — and the two fought over the path,
 * so staff tab clicks were reverted by the member hook.
 */
export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("fitcore_theme") !== "light");
  // Sign-out is confirmed here rather than in each header, so the member and
  // staff workspaces share one dialog and one copy of the wording.
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("fitcore_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  function handleLogout() {
    // Clear locally and leave straight away. Waiting on the API first meant a
    // slow or sleeping backend left the user sitting on the dashboard after
    // pressing sign out.
    //
    // The server call still goes out — it bumps token_version, retiring every
    // token already issued — but nothing depends on it returning.
    void logout().catch(() => {
      // A failed call only means old tokens stay valid until they expire;
      // the local session is gone either way.
    });
    clearSession();
    endSession();
  }

  if (!user) return null;

  const requestLogout = () => setConfirmingLogout(true);

  const confirmDialog = (
    <ConfirmDialog
      open={confirmingLogout}
      title="Do you want to sign out?"
      message="You will need to sign in again to get back in."
      confirmLabel="Yes"
      cancelLabel="No"
      onConfirm={() => { setConfirmingLogout(false); handleLogout(); }}
      onCancel={() => setConfirmingLogout(false)}
    />
  );

  if (user.role !== "member") {
    return (
      <>
        <StaffWorkspace user={user} darkMode={darkMode} setDarkMode={setDarkMode} onLogout={requestLogout} />
        {confirmDialog}
      </>
    );
  }
  return (
    <>
      <MemberDashboard darkMode={darkMode} setDarkMode={setDarkMode} onLogout={requestLogout} />
      {confirmDialog}
    </>
  );
}

function MemberDashboard({ darkMode, setDarkMode, onLogout }: { darkMode: boolean; setDarkMode: (value: boolean) => void; onLogout: () => void }) {
  const user = useAuthStore((state) => state.user);
  // Tabs are URL-backed, so each view has its own address and the browser
  // back button moves between them.
  const [tab, setTab] = useTabRoute<MemberTab>({
    validTabs: MEMBER_TABS,
    fallback: "home",
    basePath: "/app",
  });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  // Set when a previous pass is opened, so the transaction log can highlight
  // and expand that pass's payment.
  const [focusedPaymentId, setFocusedPaymentId] = useState<string | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [referrals, setReferrals] = useState<ReferralInfo | null>(null);
  // Offers the member can redeem; the backend filters out expired and
  // exhausted codes for member accounts.
  const [coupons, setCoupons] = useState<Coupon[]>([]);
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
      getCoupons(),
    ]).then(([active, previous, availablePlans, memberProfile, referralInfo, paymentHistory, offers]) => {
      if (active.status === "fulfilled") setSubscription(active.value);
      if (previous.status === "fulfilled") setHistory(previous.value);
      if (availablePlans.status === "fulfilled") setPlans(availablePlans.value);
      if (memberProfile.status === "fulfilled") setProfile(memberProfile.value);
      if (referralInfo.status === "fulfilled") setReferrals(referralInfo.value);
      if (paymentHistory.status === "fulfilled") setPayments(paymentHistory.value);
      // A failure here should not block the page; the offers section just
      // renders empty.
      if (offers.status === "fulfilled") setCoupons(offers.value);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const attendancePercent = subscription ? Math.round((subscription.days_used / subscription.allocated_days) * 100) : 0;
  // Every day attended across every subscription the member has held.
  const attendedDays = useMemo(() => {
    const days = new Set<string>();
    for (const sub of [subscription, ...history]) {
      for (const entry of sub?.attendance_log ?? []) days.add(entry.date);
    }
    return days;
  }, [subscription, history]);
  const expirySoon = Boolean(subscription && subscription.days_until_expiry <= 5 && subscription.days_until_expiry >= 0);

  return <div className="dashboard"><header className="mobile-header"><div className="header-side" /><button className="brand brand-button" onClick={() => setTab("home")} aria-label="Go to home"><span className="brand-mark"><Dumbbell size={19} /></span><span className="brand-text">FITCORE</span></button><div className="header-actions header-side"><button className="icon-button" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button" onClick={onLogout} aria-label="Sign out"><LogOut size={18} /></button></div></header><div className="app-body"><main className="member-main">{loading ? <div className="loading-state">Loading your gym space...</div> : <>{tab === "home" && <HomeView user={user} subscription={subscription} history={history} plans={plans} attendedDays={attendedDays} expirySoon={expirySoon} setTab={setTab} onChoosePlan={(plan) => { setSelectedPlan(plan); setTab("checkout"); }} />}{tab === "plans" && <PlansView plans={plans} subscription={subscription} history={history} onChoosePlan={(plan) => { setSelectedPlan(plan); setTab("checkout"); }} onViewTransaction={(paymentId) => { setFocusedPaymentId(paymentId); setTab("payments"); }} />}{tab === "checkout" && selectedPlan && <CheckoutView plan={selectedPlan} onBack={() => setTab("plans")} onComplete={() => { setTab("home"); window.location.reload(); }} />}{tab === "attendance" && <AttendanceView subscription={subscription} />}{tab === "payments" && <PaymentsView payments={payments} focusedPaymentId={focusedPaymentId} onBack={() => { setFocusedPaymentId(null); setTab("plans"); }} planNameFor={(paymentId) => [subscription, ...history].find((sub) => sub?.payment_id === paymentId)?.plan_snapshot.plan_name ?? null} />}{tab === "referrals" && <ReferralView referrals={referrals} coupons={coupons} />}{tab === "profile" && <ProfileView profile={profile} user={user} />}</>}</main><nav className="app-nav" aria-label="Main navigation">{([["home", Dumbbell, "Home"], ["plans", CreditCard, "Plans"], ["referrals", Share2, "Refer"], ["profile", UserRound, "Profile"]] as const).map(([key, Icon, label]) => <button className={tab === key ? "nav-item active" : "nav-item"} key={key} onClick={() => setTab(key)}><Icon size={19} /><span>{label}</span></button>)}</nav></div></div>;
}

/** Local YYYY-MM-DD, so "today" matches the user's calendar, not UTC. */
function toDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function HomeView({ user, subscription, history, plans, attendedDays, expirySoon, setTab, onChoosePlan }: { user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>; subscription: Subscription | null; history: Subscription[]; plans: Plan[]; attendedDays: Set<string>; expirySoon: boolean; setTab: (tab: MemberTab) => void; onChoosePlan: (plan: Plan) => void }) {
  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // The seven days ending today, so the strip always includes the current day.
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - offset));
      return { date, key: toDayKey(date), initial: WEEKDAY_INITIALS[date.getDay()] };
    });
  }, [today.getFullYear(), today.getMonth(), today.getDate()]);

  // Plans worth showing: the cheapest few the member is not already on.
  const otherPlans = useMemo(
    () => plans.filter((plan) => plan.id !== subscription?.plan_id).slice(0, 4),
    [plans, subscription?.plan_id],
  );

  return (
    <section className="view-stack">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Member home</p>
          <h1>Hey, {user.full_name.split(" ")[0]}.</h1>
        </div>
        {/* The avatar doubles as the way into profile management. */}
        <button className="avatar avatar-button" onClick={() => setTab("profile")} aria-label="Open your profile">
          {user.full_name.charAt(0)}
        </button>
      </div>

      {expirySoon && (
        <button className="renew-alert" onClick={() => setTab("plans")}>
          <span>
            <strong>Your plan ends in {subscription?.days_until_expiry} days.</strong>
            <small>Renew now or explore another plan.</small>
          </span>
          <ChevronRight size={21} />
        </button>
      )}

      {/* Row 1 — current plan beside the plans a member could move to. */}
      <div className="home-row home-row-top">
        <article className="panel plan-panel">
          <div className="panel-head">
            <p className="eyebrow">Current plan</p>
            {subscription && <span className="status-dot">Active</span>}
          </div>
          {subscription ? (
            <>
              <div className="plan-panel-ring">
                <div className="progress-ring" style={{ "--progress": `${Math.min(100, Math.round((subscription.days_used / subscription.allocated_days) * 100)) * 3.6}deg` } as React.CSSProperties}>
                  <span>{subscription.days_remaining}<small>left</small></span>
                </div>
                <div className="plan-panel-head">
                  <h2 className="plan-panel-name">{subscription.plan_snapshot.plan_name}</h2>
                  <p className="muted">{subscription.plan_snapshot.calendar_days} days · {subscription.allocated_days} visits</p>
                  <strong className="plan-panel-price">{money(subscription.plan_snapshot.price_paise)}</strong>
                </div>
              </div>

              {/* Visit usage as a bar: the ring shows what is left, this shows
                  how far through the plan the member is. */}
              <div className="plan-progress">
                <div className="plan-progress-track">
                  <div
                    className="plan-progress-fill"
                    style={{ width: `${Math.min(100, Math.round((subscription.days_used / subscription.allocated_days) * 100))}%` }}
                  />
                </div>
                <div className="plan-progress-labels">
                  <span>{subscription.days_used} of {subscription.allocated_days} visits used</span>
                  <span>{Math.round((subscription.days_used / subscription.allocated_days) * 100)}%</span>
                </div>
              </div>

              <dl className="plan-facts">
                <div>
                  <dt>Started</dt>
                  <dd>{dateLabel(subscription.starts_on)}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{dateLabel(subscription.expires_on)}</dd>
                </div>
                <div>
                  <dt>Days to renew</dt>
                  <dd>{subscription.days_until_expiry}</dd>
                </div>
              </dl>

              <button className="outline-button plan-panel-action" onClick={() => setTab("plans")}>
                Manage plan <ChevronRight size={15} />
              </button>
            </>
          ) : (
            <div className="panel-empty">
              <p>No active plan yet.</p>
              <button className="primary-action" onClick={() => setTab("plans")}>Browse plans</button>
            </div>
          )}
        </article>

        <article className="panel explore-panel">
          <div className="panel-head">
            <p className="eyebrow">Explore plans</p>
            <button className="text-button" onClick={() => setTab("plans")}>See all <ChevronRight size={15} /></button>
          </div>
          {otherPlans.length === 0 ? (
            <div className="panel-empty"><p>No other plans available right now.</p></div>
          ) : (
            <ul className="plan-rows">
              {otherPlans.map((plan) => (
                <li key={plan.id}>
                  {/* Straight to checkout for this plan, as sketched. */}
                  <button className="plan-row" onClick={() => onChoosePlan(plan)}>
                    <span className="plan-row-main">
                      <strong>{plan.plan_name}</strong>
                      <small>{plan.calendar_days} days · {plan.allocated_days} visits</small>
                    </span>
                    <span className="plan-row-price">{money(plan.price_paise)}</span>
                    <ChevronRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      {/* Row 2 — attendance calendar beside this week and the referral prompt. */}
      <div className="home-row home-row-bottom">
        <AttendanceCalendar
          monthCursor={monthCursor}
          setMonthCursor={setMonthCursor}
          attendedDays={attendedDays}
          today={today}
          onViewHistory={() => setTab("attendance")}
        />

        <div className="home-column">
          <article className="panel week-panel">
            <div className="panel-head">
              <p className="eyebrow">This week</p>
            </div>
            <ol className="week-strip">
              {weekDays.map(({ date, key, initial }) => {
                const attended = attendedDays.has(key);
                const isToday = key === toDayKey(today);
                return (
                  <li key={key}>
                    <span
                      className={`week-day${attended ? " attended" : ""}${isToday ? " is-today" : ""}`}
                      title={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}${attended ? " — visited" : ""}`}
                    >
                      <em>{initial}</em>
                      <b>{date.getDate()}</b>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="muted week-summary">
              {weekDays.filter((day) => attendedDays.has(day.key)).length} of 7 days visited
            </p>
          </article>

          <button className="panel invite-panel" onClick={() => setTab("referrals")}>
            <span>
              <strong>Invite a friend</strong>
              <small>Share your code — they save on their first plan, you earn points.</small>
            </span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Month grid marking every day the member attended the gym.
 *
 * Opens on the current month. Days are built from a local-midnight Date so a
 * visit never lands on the wrong square in a non-UTC timezone.
 */
function AttendanceCalendar({ monthCursor, setMonthCursor, attendedDays, today, onViewHistory }: { monthCursor: Date; setMonthCursor: (date: Date) => void; attendedDays: Set<string>; today: Date; onViewHistory: () => void }) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Leading blanks so the 1st lands under its weekday column.
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
  }, [year, month]);

  const monthLabel = monthCursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const visitsThisMonth = cells.filter((date) => date && attendedDays.has(toDayKey(date))).length;
  // Nothing to show beyond the current month.
  const atCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <article className="panel calendar-panel">
      <div className="panel-head">
        <p className="eyebrow">Attendance</p>
        <div className="calendar-nav">
          <button className="text-button" onClick={onViewHistory}>All visits <ChevronRight size={15} /></button>
          <button className="icon-button compact-icon" onClick={() => setMonthCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className="icon-button compact-icon" onClick={() => setMonthCursor(new Date(year, month + 1, 1))} disabled={atCurrentMonth} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <h3 className="calendar-month">{monthLabel}</h3>

      <div className="calendar-grid" role="grid" aria-label={`Attendance for ${monthLabel}`}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span className="calendar-weekday" key={`${initial}-${index}`} aria-hidden="true">{initial}</span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span className="calendar-cell empty" key={`blank-${index}`} />;
          const key = toDayKey(date);
          const attended = attendedDays.has(key);
          const isToday = key === toDayKey(today);
          const isFuture = date > today;
          return (
            <span
              key={key}
              className={`calendar-cell${attended ? " attended" : ""}${isToday ? " is-today" : ""}${isFuture ? " future" : ""}`}
              title={attended ? `Visited on ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : undefined}
            >
              {date.getDate()}
            </span>
          );
        })}
      </div>

      <p className="muted calendar-summary">
        <span className="calendar-key" aria-hidden="true" /> {visitsThisMonth} {visitsThisMonth === 1 ? "visit" : "visits"} this month
      </p>
    </article>
  );
}

/**
 * Jump navigation for the plans page.
 *
 * Sections that do not exist for this member (no active plan, no history) are
 * omitted rather than shown as dead links. The active pill tracks whichever
 * section is currently in view, so the nav reflects where you are after a
 * manual scroll, not only after a click.
 */
function PlansView({ plans, subscription, history, onChoosePlan, onViewTransaction }: { plans: Plan[]; subscription: Subscription | null; history: Subscription[]; onChoosePlan: (plan: Plan) => void; onViewTransaction: (paymentId: string) => void }) {
  const sections = useMemo(
    () => [
      ...(subscription ? [{ id: "active-plan", label: "Active plan" }] : []),
      { id: "available-plans", label: "Available plans" },
      ...(history.length > 0 ? [{ id: "previous-passes", label: "Previous passes" }] : []),
    ],
    [subscription, history.length],
  );

  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
  // While a click-triggered scroll is animating, the observer would fire for
  // every section it passes and fight the pill the user just chose. This
  // holds the observer off until the scroll settles.
  const jumpingRef = useRef(false);

  // Highlight whichever section is nearest the top of the reading area.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (jumpingRef.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      // Top-weighted band: a section counts as "current" once its heading
      // reaches the upper third, which matches where the eye lands.
      { rootMargin: "-120px 0px -55% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    // At the very bottom the last section may be too short to enter the band
    // above, which would leave the previous pill highlighted. Selecting it on
    // scroll-end keeps the nav honest.
    function handleScroll() {
      if (jumpingRef.current) return;
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      const last = sections[sections.length - 1];
      if (atBottom && last) setActiveSection(last.id);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [sections]);

  function jumpTo(id: string) {
    setActiveSection(id);
    jumpingRef.current = true;
    // `scroll-margin-top` on the targets clears the sticky header.
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Long enough for a smooth scroll to finish before tracking resumes.
    window.setTimeout(() => { jumpingRef.current = false; }, 700);
  }

  return (
    <section className="view-stack">
      <nav className="section-jump" aria-label="Jump to section">
        {sections.map((section) => (
          <button
            key={section.id}
            className={activeSection === section.id ? "jump-pill active" : "jump-pill"}
            aria-current={activeSection === section.id ? "true" : undefined}
            onClick={() => jumpTo(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {subscription && (
        <div id="active-plan" className="jump-target">
          <div className="section-heading">
            <h2>Active plan</h2>
          </div>
          <article className="current-plan">
            <div>
              <h3>{subscription.plan_snapshot.plan_name}</h3>
              <p>{subscription.days_remaining} days left · {dateLabel(subscription.expires_on)}</p>
            </div>
            <strong>{money(subscription.plan_snapshot.price_paise)}</strong>
          </article>
        </div>
      )}

      <div id="available-plans" className="jump-target">
        <div className="section-heading">
          <h2>Available plans</h2>
        </div>
        <div className="plan-list">
          {plans.map((plan) => (
            <article className="plan-card" key={plan.id}>
              <div className="plan-card-top">
                <span className="plan-category">{plan.category}</span>
                <strong>{money(plan.price_paise)}</strong>
              </div>
              <h3>{plan.plan_name}</h3>
              <p>{plan.description}</p>
              <div className="plan-meta">
                <span>{plan.calendar_days} calendar days</span>
                <span>{plan.allocated_days} gym visits</span>
              </div>
              <ul>{plan.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <button className="outline-button" onClick={() => onChoosePlan(plan)}>
                Buy this plan <ChevronRight size={16} />
              </button>
            </article>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div id="previous-passes" className="jump-target">
          <div className="section-heading">
            <h2>Previous passes</h2>
          </div>
          <div className="history-list">
            {history.map((item) => (
              // Opens the transaction behind this pass, where the receipt lives.
              <button className="history-row pass-row" key={item.id} onClick={() => onViewTransaction(item.payment_id)}>
                <div>
                  <strong>{item.plan_snapshot.plan_name}</strong>
                  <span>{dateLabel(item.created_at)} · {item.status} · {item.days_used}/{item.allocated_days} visits</span>
                </div>
                <div className="pass-row-right">
                  <strong>{money(item.plan_snapshot.price_paise)}</strong>
                  <span className="muted">View receipt</span>
                </div>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
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

  return <section className="view-stack"><button className="back-button" onClick={onBack}>← Back to plans</button><article className="checkout-card"><div className="checkout-plan"><span className="plan-category">{plan.category}</span><h2>{plan.plan_name}</h2><p>{plan.description}</p></div>
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
  return <section className="view-stack">{subscription ? <><div className="attendance-summary"><div><span>Days used</span><strong>{subscription.days_used}</strong></div><div><span>Days remaining</span><strong>{subscription.days_remaining}</strong></div><div><span>Visits logged</span><strong>{attended.size}</strong></div></div><div className="section-heading"><h2>Recent visits</h2></div><div className="history-list">{subscription.attendance_log.length ? subscription.attendance_log.slice().reverse().map((entry) => <article className="history-row" key={`${entry.date}-${entry.check_in_time}`}><div><strong>{dateLabel(entry.date)}</strong><span>Checked in at {new Date(entry.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><span className="status-dot">Logged</span></article>) : <div className="empty-state">No attendance has been recorded yet.</div>}</div></> : <div className="empty-state">Buy a plan to start tracking attendance.</div>}</section>;
}

/** Currency with paise, matching the API's amount_paid_inr formatting. */
function inrExact(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Builds a plain-text receipt for a payment.
 *
 * Text rather than PDF so it needs no dependency and stays readable when
 * forwarded or pasted into an email.
 */
function buildReceipt(payment: PaymentDetail, planName: string | null) {
  const line = "=".repeat(44);
  const rows: [string, string][] = [
    ["Receipt number", payment.receipt_number],
    ["Date", dateLabel(payment.created_at)],
    ["Status", payment.status.toUpperCase()],
    ["Method", payment.payment_method.toUpperCase()],
    ...(planName ? ([["Plan", planName]] as [string, string][]) : []),
    ["Plan price", inrExact(payment.amount_paise)],
    ...(payment.discount_paise > 0
      ? ([["Discount", `- ${inrExact(payment.discount_paise)}`]] as [string, string][])
      : []),
    ["Amount paid", payment.amount_paid_inr],
    ...(payment.gateway_payment_id
      ? ([["Transaction ID", payment.gateway_payment_id]] as [string, string][])
      : []),
  ];

  return [
    line,
    "            FITCORE — PAYMENT RECEIPT",
    line,
    "",
    ...rows.map(([label, value]) => `${label.padEnd(18)} ${value}`),
    "",
    line,
    "This is a computer-generated receipt.",
    line,
    "",
  ].join("\n");
}

/** Trigger a download without leaving the page. */
function downloadReceipt(payment: PaymentDetail, planName: string | null) {
  const blob = new Blob([buildReceipt(payment, planName)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fitcore-receipt-${payment.receipt_number}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Release the object URL once the download has started.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Transaction log, reached by opening a pass on the plans page.
 *
 * Each row carries its detail across two lines — receipt and date on the
 * first, plan and amount on the second — so nothing is truncated on a narrow
 * screen. Expanding a row reveals the full breakdown and the receipt download.
 */
function PaymentsView({ payments, focusedPaymentId, onBack, planNameFor }: { payments: PaymentDetail[]; focusedPaymentId: string | null; onBack: () => void; planNameFor: (paymentId: string) => string | null }) {
  // Opening from a pass expands that payment straight away.
  const [openId, setOpenId] = useState<string | null>(focusedPaymentId);

  useEffect(() => {
    setOpenId(focusedPaymentId);
    // Start at the top so the heading and the back link are both visible; the
    // opened row is highlighted, which is enough to locate it in a short list.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [focusedPaymentId]);

  const successful = payments.filter((item) => item.status === "success");
  const totalPaid = successful.reduce((sum, item) => sum + item.final_amount_paise, 0);
  const totalSaved = successful.reduce((sum, item) => sum + item.discount_paise, 0);

  return (
    <section className="view-stack">
      <button className="back-button" onClick={onBack}>
        <ChevronLeft size={16} /> Back to plans
      </button>

      <div className="section-heading">
        <div>
          <p className="eyebrow">Transaction log</p>
          <h2>Your payments</h2>
        </div>
        <span className="muted">{payments.length} total</span>
      </div>

      {payments.length === 0 ? (
        <div className="empty-state">You have not made any payments yet.</div>
      ) : (
        <>
          <div className="insight-grid">
            <article className="insight-card accent-card"><BadgeIndianRupee size={19} /><strong>{money(totalPaid)}</strong><span>total paid</span></article>
            <article className="insight-card"><Ticket size={19} /><strong>{money(totalSaved)}</strong><span>total saved</span></article>
            <article className="insight-card"><CheckCircle2 size={19} /><strong>{successful.length}</strong><span>successful</span></article>
          </div>

          <div className="history-list">
            {payments.map((item) => {
              const open = openId === item.id;
              const planName = planNameFor(item.id);
              const isFocused = focusedPaymentId === item.id;
              return (
                <article
                  id={`payment-${item.id}`}
                  className={`payment-row${open ? " open" : ""}${isFocused ? " focused" : ""}`}
                  key={item.id}
                >
                  <button className="payment-row-head" onClick={() => setOpenId(open ? null : item.id)} aria-expanded={open}>
                    {/* Two rows: identity on top, what it bought below. */}
                    <span className="txn-lines">
                      <span className="txn-line-1">
                        <strong>{item.receipt_number}</strong>
                        <span className={item.status === "success" ? "status-dot" : "status-dot failed"}>{item.status}</span>
                      </span>
                      <span className="txn-line-2">
                        <span>{planName ?? "Gym plan"}</span>
                        <span className="txn-dot">·</span>
                        <span>{dateLabel(item.created_at)}</span>
                        <span className="txn-dot">·</span>
                        <span>{item.payment_method.toUpperCase()}</span>
                      </span>
                    </span>
                    <span className="txn-amount">
                      <strong>{money(item.final_amount_paise)}</strong>
                      {item.discount_paise > 0 && <small>saved {money(item.discount_paise)}</small>}
                    </span>
                    <ChevronRight size={16} className={open ? "txn-chevron open" : "txn-chevron"} />
                  </button>

                  {open && (
                    <div className="payment-detail">
                      <Detail label="Receipt number" value={item.receipt_number} />
                      {planName && <Detail label="Plan" value={planName} />}
                      <Detail label="Date" value={dateLabel(item.created_at)} />
                      <Detail label="Plan price" value={inrExact(item.amount_paise)} />
                      {item.discount_paise > 0 && <Detail label="Discount" value={`- ${inrExact(item.discount_paise)}`} />}
                      <Detail label="Amount paid" value={item.amount_paid_inr} />
                      <Detail label="Method" value={item.payment_method.toUpperCase()} />
                      {item.gateway_payment_id && <Detail label="Transaction ID" value={item.gateway_payment_id} />}
                      <div className="receipt-actions">
                        <button className="outline-button compact-button" onClick={() => downloadReceipt(item, planName)}>
                          <Download size={15} /> Download receipt
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
/**
 * Refer tab: code, history and live offers.
 *
 * Three jump options at the top scroll to the matching section, mirroring the
 * plans page so the two behave the same way.
 */
function ReferralView({ referrals, coupons }: { referrals: ReferralInfo | null; coupons: Coupon[] }) {
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState("referral-code");
  const jumpingRef = useRef(false);

  // Follows whatever origin the app is served from, so it is a localhost link
  // in development and the real domain once deployed. VITE_PUBLIC_SITE_URL
  // overrides it when the public site differs from where the app is hosted.
  const siteOrigin = import.meta.env.VITE_PUBLIC_SITE_URL ?? window.location.origin;
  const shareLink = referrals ? `${siteOrigin}/register?ref=${encodeURIComponent(referrals.my_referral_code)}` : "";

  const sections = useMemo(
    () => [
      { id: "referral-code", label: "Referral code" },
      { id: "referral-history", label: "Referral history" },
      { id: "offers", label: "Offers" },
    ],
    [],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (jumpingRef.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    // The last section may be too short to enter the band above, which would
    // strand the previous pill; selecting it at the page bottom keeps the nav
    // honest.
    function handleScroll() {
      if (jumpingRef.current) return;
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      const last = sections[sections.length - 1];
      if (atBottom && last) setActiveSection(last.id);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [sections]);

  function jumpTo(id: string) {
    setActiveSection(id);
    jumpingRef.current = true;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => { jumpingRef.current = false; }, 700);
  }

  async function copyCode() {
    if (!referrals) return;
    await navigator.clipboard?.writeText(referrals.my_referral_code);
    setNotice("Referral code copied.");
  }

  async function copyLink() {
    if (!referrals) return;
    await navigator.clipboard?.writeText(shareLink);
    setNotice("Referral link copied.");
  }

  async function shareCode() {
    if (!referrals) return;
    if (navigator.share) {
      await navigator.share({
        title: "Join me at FitCore",
        text: `Join FitCore with my referral code ${referrals.my_referral_code}.`,
        url: shareLink,
      });
    } else {
      await copyLink();
    }
  }

  const discountLabel = (coupon: Coupon) =>
    coupon.discount_type === "percentage"
      ? `${coupon.discount_value}% off`
      : `${money(coupon.discount_value)} off`;

  if (!referrals) {
    return <section className="view-stack"><div className="empty-state">Referral information is not available yet.</div></section>;
  }

  return (
    <section className="view-stack">
      <nav className="section-jump" aria-label="Jump to section">
        {sections.map((section) => (
          <button
            key={section.id}
            className={activeSection === section.id ? "jump-pill active" : "jump-pill"}
            aria-current={activeSection === section.id ? "true" : undefined}
            onClick={() => jumpTo(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {notice && <div className="profile-message">{notice}</div>}

      {/* ── Referral code ── */}
      <div id="referral-code" className="jump-target">
        <div className="section-heading">
          <h2>Your referral code</h2>
        </div>
        <div className="referral-code">
          <div>
            <span>Share this code</span>
            <strong>{referrals.my_referral_code}</strong>
            <small>{shareLink}</small>
          </div>
          <div className="referral-actions">
            <button className="icon-button" onClick={copyCode} aria-label="Copy referral code"><Copy size={18} /></button>
            <button className="share-button" onClick={shareCode}>Share</button>
          </div>
        </div>
        <div className="insight-grid">
          <article className="insight-card"><Users size={19} /><strong>{referrals.stats.total_referrals}</strong><span>people referred</span></article>
          <article className="insight-card accent-card"><Sparkles size={19} /><strong>{referrals.stats.total_points_earned}</strong><span>points earned</span></article>
          <article className="insight-card"><CheckCircle2 size={19} /><strong>{referrals.stats.successful_joins}</strong><span>converted</span></article>
        </div>
      </div>

      {/* ── Referral history ── */}
      <div id="referral-history" className="jump-target">
        <div className="section-heading">
          <h2>Referral history</h2>
          <span className="muted">{referrals.referred_members.length} total</span>
        </div>
        <div className="history-list">
          {referrals.referred_members.length ? (
            referrals.referred_members.map((member) => (
              <article className="history-row" key={member.user_id}>
                <div>
                  <strong>{member.full_name}</strong>
                  <span>Joined {dateLabel(member.joined_on)}</span>
                </div>
                <span className={member.has_purchased ? "status-dot" : "muted"}>
                  {member.has_purchased ? "Converted" : "Joined"}
                </span>
              </article>
            ))
          ) : (
            <div className="empty-state">Share your code to start your referral history.</div>
          )}
        </div>
      </div>

      {/* ── Offers ── */}
      <div id="offers" className="jump-target">
        <div className="section-heading">
          <h2>Offers</h2>
          <span className="muted">{coupons.length} available</span>
        </div>
        {coupons.length === 0 ? (
          <div className="empty-state">No offers are running at the moment.</div>
        ) : (
          <>
            <div className="history-list">
              {coupons.map((coupon) => (
                <article className="history-row catalogue-row" key={coupon.id}>
                  <div>
                    <strong>{coupon.code}</strong>
                    <span>{discountLabel(coupon)} · {coupon.name}</span>
                    <small className="muted">
                      Valid till {dateLabel(coupon.valid_until)}
                      {coupon.min_plan_price_paise > 0 && ` · min ${money(coupon.min_plan_price_paise)}`}
                    </small>
                  </div>
                  <button
                    className="outline-button compact-button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(coupon.code);
                      setNotice(`Coupon ${coupon.code} copied — apply it at checkout.`);
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </article>
              ))}
            </div>
            <p className="muted catalogue-note">Apply a code at checkout to use it.</p>
          </>
        )}
      </div>
    </section>
  );
}
function LegacyProfileView({ profile, user }: { profile: MemberProfile | null; user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]> }) {
  return <section className="view-stack"><div className="profile-card"><div className="profile-avatar">{user.full_name.charAt(0)}</div><div><h3>{profile?.full_name ?? user.full_name}</h3><p>{profile?.email ?? "No email added"}</p><span className="status-dot">{profile?.gym_meta?.membership_status ?? user.membership_status}</span></div></div><div className="detail-list"><Detail label="Phone" value={profile?.phone ?? user.phone} /><Detail label="Member since" value={dateLabel(profile?.gym_meta?.joined_on)} /><Detail label="Location" value={[profile?.profile?.address?.city, profile?.profile?.address?.state].filter(Boolean).join(", ") || "Not added"} /><Detail label="Points" value={`${profile?.loyalty_points ?? 0} loyalty points`} /></div><div className="later-card"><Sparkles size={20} /><div><strong>Rewards history is coming next.</strong><p>We will connect membership age, gym days, and plans bought when the Rewards API is ready.</p></div></div></section>;
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

  return <section className="view-stack"><div className="profile-card"><div className="profile-avatar">{(profile?.full_name ?? user.full_name).charAt(0)}</div><div><h3>{profile?.full_name ?? user.full_name}</h3><p>{profile?.email ?? "No email added"}</p><span className="status-dot">{profile?.gym_meta?.membership_status ?? user.membership_status}</span></div><button className="outline-button compact-button" onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit profile"}</button></div>{message && <div className="profile-message">{message}</div>}{editing ? <div className="profile-form"><div className="field"><label>Full name</label><input value={form.full_name} onChange={change("full_name")} /></div><div className="field"><label>Phone <span className="optional-label">cannot be changed</span></label><input value={profile?.phone ?? user.phone} disabled /></div><div className="field"><label>Email <span className="optional-label">cannot be changed</span></label><input type="email" value={form.email} disabled /></div><div className="profile-form-grid"><div className="field"><label>Date of birth</label><input type="date" value={form.dob} onChange={change("dob")} /></div><div className="field"><label>Gender</label><input value={form.gender} onChange={change("gender")} placeholder="Not specified" /></div><div className="field"><label>Blood group</label><input value={form.blood_group} onChange={change("blood_group")} placeholder="e.g. B+" /></div><div className="field"><label>Street</label><input value={form.street} onChange={change("street")} /></div><div className="field"><label>City</label><input value={form.city} onChange={change("city")} /></div><div className="field"><label>State</label><input value={form.state} onChange={change("state")} /></div><div className="field"><label>Pincode</label><input value={form.pincode} onChange={change("pincode")} /></div></div><button className="primary-action" onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div> : <><div className="detail-list"><Detail label="Phone" value={profile?.phone ?? user.phone} /><Detail label="Email" value={profile?.email ?? "Not added"} /><Detail label="Date of birth" value={dateLabel(profile?.profile?.dob)} /><Detail label="Gender" value={profile?.profile?.gender ?? "Not added"} /><Detail label="Blood group" value={profile?.profile?.blood_group ?? "Not added"} /><Detail label="Address" value={[profile?.profile?.address?.street, profile?.profile?.address?.city, profile?.profile?.address?.state, profile?.profile?.address?.pincode].filter(Boolean).join(", ") || "Not added"} /><Detail label="Role" value={profile?.role === "owner" ? "Admin" : profile?.role ?? "Member"} /><Detail label="Member since" value={dateLabel(profile?.gym_meta?.joined_on)} /><Detail label="Assigned trainer" value={profile?.gym_meta?.assigned_trainer_name ?? "Not assigned"} /><Detail label="Referral code" value={profile?.my_referral_code ?? "Not available"} /><Detail label="Loyalty points" value={`${profile?.loyalty_points ?? 0} points`} /><Detail label="Active subscription" value={profile?.active_subscription_id ? "Active" : "None"} /></div><div className="later-card"><Sparkles size={20} /><div><strong>Rewards history is coming next.</strong><p>We will connect your membership age, gym days, and plans bought when the Rewards API is ready.</p></div></div></>}</section>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>; }
// function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{subtitle}</p></div>; }
